const { pool } = require('../utils/database');
const bcrypt = require('bcryptjs');
const { customLogger } = require('../utils/logger');

// ユーザー一覧取得
const getUsers = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザー情報を取得（JSON形式のsatellite_idsを適切に処理）
    const [rows] = await connection.execute(`
      SELECT 
        *,
        CASE 
          WHEN satellite_ids IS NOT NULL AND satellite_ids != 'null' 
          THEN JSON_UNQUOTE(satellite_ids)
          ELSE NULL 
        END as satellite_ids_processed
      FROM user_accounts
    `);
    console.log('取得したユーザー数:', rows.length);
    
    // 拠点情報を取得
    const [satellites] = await connection.execute(`
      SELECT s.*, c.name as company_name, ot.type as office_type_name
      FROM satellites s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN office_types ot ON s.office_type_id = ot.id
    `);
    console.log('取得した拠点数:', satellites.length);
    console.log('拠点データ:', satellites);
    
    // 拠点情報をマップ化
    const satelliteMap = {};
    satellites.forEach(sat => {
      satelliteMap[Number(sat.id)] = {
        id: sat.id,
        name: sat.name,
        address: sat.address,
        phone: sat.phone,
        company_name: sat.company_name,
        office_type_name: sat.office_type_name
      };
    });
    console.log('拠点マップ:', satelliteMap);
    
    // ユーザー情報に拠点情報を追加
    const processedRows = rows.map(row => {
      const user = { ...row };
      
      // satellite_idsから拠点情報を取得
      let satelliteDetails = [];
      if (user.satellite_ids_processed) {
        try {
          let satelliteIds;
          
          // satellite_ids_processedを使用して処理
          if (typeof user.satellite_ids_processed === 'string') {
            satelliteIds = JSON.parse(user.satellite_ids_processed);
          } else if (Array.isArray(user.satellite_ids_processed)) {
            satelliteIds = user.satellite_ids_processed;
          } else {
            satelliteIds = [user.satellite_ids_processed];
          }
          
          console.log(`ユーザー${user.id}の拠点ID:`, satelliteIds);
          console.log(`ユーザー${user.id}の拠点IDの型:`, typeof satelliteIds);
          console.log(`拠点マップのキー:`, Object.keys(satelliteMap));
          
          // satelliteIdsが配列でない場合は配列に変換
          const idsArray = Array.isArray(satelliteIds) ? satelliteIds : [satelliteIds];
          
          satelliteDetails = idsArray
            .map(id => {
              const mappedSatellite = satelliteMap[Number(id)];
              console.log(`拠点ID ${id} のマッピング結果:`, mappedSatellite);
              return mappedSatellite;
            })
            .filter(sat => sat); // nullの要素を除外
          console.log(`ユーザー${user.id}の拠点詳細:`, satelliteDetails);
        } catch (e) {
          console.error('拠点IDのパースエラー:', e);
          console.error('パース対象のsatellite_ids_processed:', user.satellite_ids_processed);
          console.error('satellite_ids_processedの型:', typeof user.satellite_ids_processed);
          console.error('元のsatellite_ids:', user.satellite_ids);
          satelliteDetails = [];
        }
      } else {
        console.log(`ユーザー${user.id}のsatellite_idsはnullまたはundefined`);
      }
      
      user.satellite_details = satelliteDetails;
      return user;
    });
    
    return {
      success: true,
      data: {
        users: processedRows,
        count: processedRows.length
      }
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    return {
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// 企業別最上位ユーザー取得
const getTopUsersByCompany = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const query = `
      SELECT 
        c.id as company_id,
        c.name as company_name,
        ua.id as user_id,
        ua.name as user_name,
        ua.role,
        ua.satellite_ids
      FROM companies c
      LEFT JOIN user_accounts ua ON c.id = ua.company_id
      WHERE ua.role = (
        SELECT MAX(role) 
        FROM user_accounts ua2 
        WHERE ua2.company_id = c.id
      )
      ORDER BY c.id, ua.role DESC, ua.id
    `;
    
    const [rows] = await connection.execute(query);
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('Error fetching top users by company:', error);
    return {
      success: false,
      message: 'Failed to fetch top users by company',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// 企業別ロール4以上のユーザー数取得
const getTeachersByCompany = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const query = `
      SELECT 
        c.id as company_id,
        c.name as company_name,
        COUNT(ua.id) as teacher_count
      FROM companies c
      LEFT JOIN user_accounts ua ON c.id = ua.company_id AND ua.role >= 4
      GROUP BY c.id, c.name
      ORDER BY c.id
    `;
    
    const [rows] = await connection.execute(query);
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('Error fetching teachers by company:', error);
    return {
      success: false,
      message: 'Failed to fetch teachers by company',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// ヘルスチェック
const healthCheck = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT NOW() as current_datetime');
    const currentTime = rows[0].current_datetime;
    
    return {
      success: true,
      data: {
        message: 'Express + MySQL Docker Compose Starter is running!',
        database: 'Connected successfully',
        currentTime: currentTime,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Health check error:', error);
    return {
      success: false,
      message: 'Database connection failed',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// ユーザーの所属拠点を取得
const getUserSatellites = async (userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT 
        s.id,
        s.name,
        s.address,
        s.max_users,
        s.status,
        c.name as company_name
      FROM user_accounts ua
      JOIN satellites s ON JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
      JOIN companies c ON s.company_id = c.id
      WHERE ua.id = ?
    `, [userId]);

    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('Error fetching user satellites:', error);
    return {
      success: false,
      message: '所属拠点の取得に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// 拠点に所属するユーザー一覧を取得
const getSatelliteUsers = async (satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.role,
        ua.status,
        ua.login_code,
        ua.is_remote_user,
        ua.recipient_number
      FROM user_accounts ua
      WHERE JSON_CONTAINS(ua.satellite_ids, ?) AND ua.status = 1
      ORDER BY ua.role DESC, ua.name
    `, [JSON.stringify(satelliteId)]);

    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('Error fetching satellite users:', error);
    return {
      success: false,
      message: '拠点ユーザーの取得に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// ユーザーに拠点を追加
const addSatelliteToUser = async (userId, satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザーの存在確認
    const [userRows] = await connection.execute(
      'SELECT satellite_ids FROM user_accounts WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return {
        success: false,
        message: 'ユーザーが見つかりません'
      };
    }

    // 拠点の存在確認
    const [satelliteRows] = await connection.execute(
      'SELECT id FROM satellites WHERE id = ?',
      [satelliteId]
    );

    if (satelliteRows.length === 0) {
      return {
        success: false,
        message: '拠点が見つかりません'
      };
    }

    // 既存の拠点配列を取得
    const currentSatellites = userRows[0].satellite_ids ? JSON.parse(userRows[0].satellite_ids) : [];
    
    // 既に所属しているかチェック
    if (currentSatellites.includes(satelliteId)) {
      return {
        success: false,
        message: '既に拠点に所属しています'
      };
    }

    // 拠点を追加
    currentSatellites.push(satelliteId);
    await connection.execute(
      'UPDATE user_accounts SET satellite_ids = ? WHERE id = ?',
      [JSON.stringify(currentSatellites), userId]
    );

    return {
      success: true,
      message: '拠点が追加されました'
    };
  } catch (error) {
    console.error('Error adding satellite to user:', error);
    return {
      success: false,
      message: '拠点の追加に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// ユーザーから拠点を削除
const removeSatelliteFromUser = async (userId, satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザーの存在確認
    const [userRows] = await connection.execute(
      'SELECT satellite_ids FROM user_accounts WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return {
        success: false,
        message: 'ユーザーが見つかりません'
      };
    }

    // 既存の拠点配列を取得
    const currentSatellites = userRows[0].satellite_ids ? JSON.parse(userRows[0].satellite_ids) : [];
    
    // 拠点配列から削除
    const updatedSatellites = currentSatellites.filter(id => id !== satelliteId);

    if (currentSatellites.length === updatedSatellites.length) {
      return {
        success: false,
        message: '指定された拠点には所属していません'
      };
    }

    // 拠点を削除
    await connection.execute(
      'UPDATE user_accounts SET satellite_ids = ? WHERE id = ?',
      [JSON.stringify(updatedSatellites), userId]
    );

    return {
      success: true,
      message: '拠点が削除されました'
    };
  } catch (error) {
    console.error('Error removing satellite from user:', error);
    return {
      success: false,
      message: '拠点の削除に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// ユーザー作成
const createUser = async (userData) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // トランザクション開始
    await connection.beginTransaction();
    
    // ログインコードの生成（指定されていない場合）
    // XXXX-XXXX-XXXX形式（英数大文字小文字交じり）
    const generateLoginCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const generatePart = () => {
        let result = '';
        for (let i = 0; i < 4; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      return `${generatePart()}-${generatePart()}-${generatePart()}`;
    };
    

    
    const loginCode = userData.login_code || generateLoginCode();
    
    // ユーザー作成
    const [result] = await connection.execute(
      `INSERT INTO user_accounts (
        name, 
        email,
        role, 
        status, 
        login_code, 
        company_id, 
        satellite_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.name,
        userData.email || null,
        userData.role || 1,
        userData.status || 1,
        loginCode,
        userData.company_id || 4,
        JSON.stringify(userData.satellite_ids || [])
      ]
    );

    const userId = result.insertId;

    // ロール4以上（指導員・管理者）の場合は認証情報も作成
    if (userData.role >= 4) {
      const hashedPassword = await bcrypt.hash(userData.password || 'defaultPassword123', 10);
      
      await connection.execute(
        `INSERT INTO admin_credentials (
          user_id, 
          username, 
          password_hash
        ) VALUES (?, ?, ?)`,
        [
          userId,
          userData.name, // ユーザー名をログインIDとして使用
          hashedPassword
        ]
      );
    }

    // トランザクションコミット
    await connection.commit();

    return {
      success: true,
      message: 'ユーザーが正常に作成されました',
      data: {
        id: userId,
        name: userData.name,
        role: userData.role,
        login_code: loginCode
      }
    };
  } catch (error) {
    // エラー時はロールバック
    if (connection) {
      await connection.rollback();
    }
    console.error('Error creating user:', error);
    return {
      success: false,
      message: 'ユーザーの作成に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// ユーザー更新
const updateUser = async (userId, updateData) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 更新可能なフィールドを構築
    const updateFields = [];
    const updateValues = [];
    
    if (updateData.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updateData.name);
    }
    
    if (updateData.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(updateData.email);
    }
    
    if (updateData.role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(updateData.role);
    }
    
    if (updateData.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(updateData.status);
    }
    
    if (updateData.satellite_ids !== undefined) {
      updateFields.push('satellite_ids = ?');
      updateValues.push(JSON.stringify(updateData.satellite_ids));
    }
    
    if (updateFields.length === 0) {
      return {
        success: false,
        message: '更新するフィールドが指定されていません'
      };
    }
    
    updateValues.push(userId);
    
    const [result] = await connection.execute(
      `UPDATE user_accounts SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return {
        success: false,
        message: '指定されたユーザーが見つかりません'
      };
    }

    return {
      success: true,
      message: 'ユーザーが正常に更新されました'
    };
  } catch (error) {
    console.error('Error updating user:', error);
    return {
      success: false,
      message: 'ユーザーの更新に失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// パスワードリセット
const resetUserPassword = async (userId, resetData) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザーの存在確認
    const [userRows] = await connection.execute(
      'SELECT id, name FROM user_accounts WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return {
        success: false,
        message: '指定されたユーザーが見つかりません'
      };
    }

    let hashedPassword;
    if (resetData.tempPassword) {
      // 一時パスワードを設定
      hashedPassword = await bcrypt.hash(resetData.tempPassword, 10);
    } else {
      // デフォルトパスワードを設定
      hashedPassword = await bcrypt.hash('defaultPassword123', 10);
    }
    
    // admin_credentialsテーブルを更新
    const [result] = await connection.execute(
      'UPDATE admin_credentials SET password_hash = ? WHERE user_id = ?',
      [hashedPassword, userId]
    );

    if (result.affectedRows === 0) {
      // admin_credentialsにレコードがない場合は新規作成
      await connection.execute(
        'INSERT INTO admin_credentials (user_id, username, password_hash) VALUES (?, ?, ?)',
        [userId, userRows[0].name, hashedPassword]
      );
    }

    return {
      success: true,
      message: 'パスワードが正常にリセットされました',
      data: {
        tempPassword: resetData.tempPassword || 'defaultPassword123'
      }
    };
  } catch (error) {
    console.error('Error resetting user password:', error);
    return {
      success: false,
      message: 'パスワードのリセットに失敗しました',
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

module.exports = {
  getUsers,
  getTopUsersByCompany,
  getTeachersByCompany,
  healthCheck,
  getUserSatellites,
  getSatelliteUsers,
  addSatelliteToUser,
  removeSatelliteFromUser,
  createUser,
  updateUser,
  resetUserPassword
}; 