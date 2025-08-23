const { pool } = require('../utils/database');
const bcrypt = require('bcryptjs');
const { customLogger } = require('../utils/logger');

// ログインコード生成関数
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

// パスワード生成関数（XXXX-XXXX形式）
const generateTemporaryPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const generatePart = () => {
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  return `${generatePart()}-${generatePart()}`;
};

// 日本時間の今日の23:59を取得
const getTodayEndTime = () => {
  const now = new Date();
  const japanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  const endOfDay = new Date(japanTime);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
};

// パスワード有効期限チェック
const isPasswordValid = (expiryTime) => {
  if (!expiryTime) return false;
  const now = new Date();
  const japanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  return new Date(expiryTime) > japanTime;
};

// ユーザー一覧取得
const getUsers = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザー情報を取得（JSON形式のsatellite_idsを適切に処理）
    const [rows] = await connection.execute(`
      SELECT 
        ua.*,
        CASE 
          WHEN ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' 
          THEN JSON_UNQUOTE(ua.satellite_ids)
          ELSE NULL 
        END as satellite_ids_processed,
        ac.username,
        instructor.name as instructor_name
      FROM user_accounts ua
      LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
      LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
    `);
    
    console.log('=== ユーザー一覧取得 ===');
    console.log('取得したユーザー数:', rows.length);
    // ロール4以上のユーザーのusernameを確認
    const adminUsers = rows.filter(row => row.role >= 4);
    console.log('管理者・指導員ユーザー:', adminUsers.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role })));
    
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
    
    // 進行度を計算する関数
    const calculateProgress = async (userId) => {
      try {
        // カリキュラム進行状況を取得
        const [progressRows] = await connection.execute(`
          SELECT 
            curriculum_name,
            session_number,
            chapter_number,
            deliverable_confirmed,
            test_passed
          FROM curriculum_progress 
          WHERE user_id = ?
        `, [userId]);
        
        if (progressRows.length === 0) {
          // カリキュラムが紐づいていない場合は0を返す
          return 0;
        }
        
        // 進行度を計算（完了した章の割合）
        let totalChapters = 0;
        let completedChapters = 0;
        
        progressRows.forEach(row => {
          totalChapters++;
          if (row.deliverable_confirmed && row.test_passed) {
            completedChapters++;
          }
        });
        
        return totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;
      } catch (error) {
        console.error('進行度計算エラー:', error);
        return 0;
      }
    };
    
    // ユーザー情報に拠点情報を追加
    const processedRows = await Promise.all(rows.map(async (row) => {
      const user = { ...row };
      
      // 進行度を計算（ロール1の利用者のみ）
      if (user.role === 1) {
        user.progress = await calculateProgress(user.id);
      } else {
        user.progress = 0; // 管理者・指導員は進行度なし
      }
      
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
    }));
    
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
        ua.recipient_number,
        ua.instructor_id,
        instructor.name as instructor_name
      FROM user_accounts ua
      LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
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
    const parsed = userRows[0].satellite_ids ? JSON.parse(userRows[0].satellite_ids) : [];
    const currentSatellites = Array.isArray(parsed) ? parsed : [parsed];
    
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
    console.log('=== createUser Debug ===');
    console.log('受信データ:', userData);
    console.log('username:', userData.username);
    console.log('role:', userData.role);
    
    connection = await pool.getConnection();
    
    // トランザクション開始
    await connection.beginTransaction();
    
    // ロール4以上（指導員・管理者）の場合、usernameの一意性チェック
    if (userData.role >= 4 && userData.username) {
      console.log('username一意性チェック開始:', userData.username);
      const [existingUsers] = await connection.execute(
        'SELECT id FROM admin_credentials WHERE username = ?',
        [userData.username]
      );
      
      if (existingUsers.length > 0) {
        console.log('username重複エラー:', userData.username);
        return {
          success: false,
          message: '指定されたログインIDは既に使用されています'
        };
      }
      console.log('username一意性チェックOK');
    }
    
    // ログインコードの生成（指定されていない場合）
    // XXXX-XXXX-XXXX形式（英数大文字小文字交じり）
    

    
    // フロントエンドから送信されたログインコードを無視し、常に新しい形式で生成
    const loginCode = generateLoginCode();
    
    // ユーザー作成
    const [result] = await connection.execute(
      `INSERT INTO user_accounts (
        name, 
        email,
        role, 
        status, 
        login_code, 
        company_id, 
        satellite_ids,
        instructor_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.name,
        userData.email || null,
        userData.role || 1,
        userData.status || 1,
        loginCode,
        userData.company_id || 4,
        JSON.stringify(userData.satellite_ids || []),
        userData.instructor_id || null
      ]
    );

    const userId = result.insertId;

    // ロール4以上（指導員・管理者）の場合は認証情報も作成
    if (userData.role >= 4) {
      console.log('admin_credentials作成開始');
      console.log('userId:', userId);
      console.log('username:', userData.username);
      
      const hashedPassword = await bcrypt.hash(userData.password || 'defaultPassword123', 10);
      
      // usernameが指定されていない場合はエラー
      if (!userData.username) {
        console.log('username未指定エラー');
        return {
          success: false,
          message: 'ログインIDは必須です'
        };
      }
      
      console.log('admin_credentials INSERT実行:', {
        user_id: userId,
        username: userData.username,
        password_hash: hashedPassword.substring(0, 20) + '...'
      });
      
      await connection.execute(
        `INSERT INTO admin_credentials (
          user_id, 
          username, 
          password_hash
        ) VALUES (?, ?, ?)`,
        [
          userId,
          userData.username,
          hashedPassword
        ]
      );
      
      console.log('admin_credentials作成完了');
      
      // 保存確認のためのクエリ
      const [savedCredentials] = await connection.execute(
        'SELECT * FROM admin_credentials WHERE user_id = ?',
        [userId]
      );
      console.log('保存確認:', savedCredentials);
    }

    // 指導員の場合、専門分野を保存
    if (userData.role === 4 && userData.department && userData.department.trim()) {
      console.log('専門分野保存開始:', userData.department);
      await connection.execute(
        `INSERT INTO instructor_specializations (user_id, specialization)
         VALUES (?, ?)`,
        [userId, userData.department.trim()]
      );
      console.log('専門分野保存完了');
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
    
    // usernameの更新がある場合、一意性チェック
    if (updateData.username) {
      const [existingUsers] = await connection.execute(
        'SELECT id FROM admin_credentials WHERE username = ? AND user_id != ?',
        [updateData.username, userId]
      );
      
      if (existingUsers.length > 0) {
        return {
          success: false,
          message: '指定されたログインIDは既に使用されています'
        };
      }
    }
    
    // 更新可能なフィールドを構築
    const updateFields = [];
    const updateValues = [];
    
    if (updateData.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updateData.name);
    }
    
    if (updateData.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(updateData.email.trim() || null);
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
    
    if (updateData.instructor_id !== undefined) {
      updateFields.push('instructor_id = ?');
      updateValues.push(updateData.instructor_id);
    }
    
    // user_accountsテーブルの更新
    if (updateFields.length > 0) {
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
    }
    
    // admin_credentialsテーブルの更新（usernameがある場合）
    if (updateData.username) {
      // ユーザーがロール4以上かチェック
      const [userRows] = await connection.execute(
        'SELECT role FROM user_accounts WHERE id = ?',
        [userId]
      );
      
      if (userRows.length > 0 && userRows[0].role >= 4) {
        // admin_credentialsテーブルを更新
        await connection.execute(
          'UPDATE admin_credentials SET username = ? WHERE user_id = ?',
          [updateData.username, userId]
        );
      }
    }

    // 専門分野の更新（指導員の場合）
    if (updateData.specialization !== undefined) {
      // 既存の専門分野を削除
      await connection.execute(
        'DELETE FROM instructor_specializations WHERE user_id = ?',
        [userId]
      );
      
      // 新しい専門分野を追加（空でない場合のみ）
      if (updateData.specialization && updateData.specialization.trim()) {
        // カンマ区切りで複数の専門分野を分割
        const specializations = updateData.specialization
          .split(',')
          .map(spec => spec.trim())
          .filter(spec => spec.length > 0);
        
        for (const specialization of specializations) {
          await connection.execute(
            'INSERT INTO instructor_specializations (user_id, specialization) VALUES (?, ?)',
            [userId, specialization]
          );
        }
      }
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

// ユーザー削除
const deleteUser = async (userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // トランザクション開始
    await connection.beginTransaction();
    
    // ユーザーの存在確認
    const [userRows] = await connection.execute(
      'SELECT id, name, role FROM user_accounts WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return {
        success: false,
        message: '指定されたユーザーが見つかりません'
      };
    }

    const user = userRows[0];

    // 削除前のチェック
    // 1. このユーザーが他のユーザーの指導員として設定されていないかチェック
    const [instructorCheck] = await connection.execute(
      'SELECT COUNT(*) as count FROM user_accounts WHERE instructor_id = ?',
      [userId]
    );
    
    if (instructorCheck[0].count > 0) {
      return {
        success: false,
        message: 'このユーザーは他の利用者の指導員として設定されているため削除できません。先に指導員設定を変更してください。'
      };
    }

    // 関連するデータを削除（外部キー制約があるため、順序が重要）
    
    // 1. リフレッシュトークンを削除（外部キー制約なし）
    try {
      await connection.execute(
        'DELETE FROM refresh_tokens WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.log('refresh_tokensテーブルが存在しないか、削除に失敗:', error.message);
    }
    
    // 2. 一時パスワードを削除（外部キー制約あり）
    try {
      await connection.execute(
        'DELETE FROM user_temp_passwords WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.log('user_temp_passwordsテーブルが存在しないか、削除に失敗:', error.message);
    }
    
    // 3. カリキュラム進行状況を削除（外部キー制約あり）
    try {
      await connection.execute(
        'DELETE FROM curriculum_progress WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.log('curriculum_progressテーブルが存在しないか、削除に失敗:', error.message);
    }
    
    // 4. テスト結果を削除（外部キー制約あり）
    try {
      await connection.execute(
        'DELETE FROM test_results WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.log('test_resultsテーブルが存在しないか、削除に失敗:', error.message);
    }
    
    // 5. GATB診断スコアを削除（外部キー制約あり）
    try {
      await connection.execute(
        'DELETE FROM gatb_results WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.log('gatb_resultsテーブルが存在しないか、削除に失敗:', error.message);
    }
    
    // 6. ロール4以上（指導員・管理者）の場合は認証情報も削除（外部キー制約あり）
    if (user.role >= 4) {
      try {
        await connection.execute(
          'DELETE FROM admin_credentials WHERE user_id = ?',
          [userId]
        );
      } catch (error) {
        console.log('admin_credentialsテーブルが存在しないか、削除に失敗:', error.message);
      }
    }

    // 8. 最後にユーザーを削除
    await connection.execute(
      'DELETE FROM user_accounts WHERE id = ?',
      [userId]
    );

    // トランザクションコミット
    await connection.commit();

    return {
      success: true,
      message: 'ユーザーが正常に削除されました'
    };
  } catch (error) {
    // エラー時はロールバック
    if (connection) {
      await connection.rollback();
    }
    console.error('Error deleting user:', error);
    return {
      success: false,
      message: 'ユーザーの削除に失敗しました',
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

    const user = userRows[0];

    if (resetData.action === 'issue_temp_password') {
      // 一時パスワード発行
      const tempPassword = generateTemporaryPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      // admin_credentialsテーブルを更新
      const [result] = await connection.execute(
        'UPDATE admin_credentials SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
        [hashedPassword, userId]
      );

      if (result.affectedRows === 0) {
        // admin_credentialsにレコードがない場合は新規作成
        await connection.execute(
          'INSERT INTO admin_credentials (user_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [userId, user.name, hashedPassword]
        );
      }

      // パスワード変更要求フラグを設定
      await connection.execute(
        'UPDATE user_accounts SET password_reset_required = 1 WHERE id = ?',
        [userId]
      );

      return {
        success: true,
        message: '一時パスワードが発行されました。指導員は次回ログイン時に新しいパスワードを設定する必要があります。',
        data: {
          tempPassword: tempPassword
        }
      };
    } else if (resetData.action === 'require_password_change') {
      // パスワード変更要求
      await connection.execute(
        'UPDATE user_accounts SET password_reset_required = 1 WHERE id = ?',
        [userId]
      );

      return {
        success: true,
        message: 'パスワード変更要求が送信されました。指導員は次回ログイン時にパスワードの変更が必要です。'
      };
    } else {
      return {
        success: false,
        message: '無効なアクションです'
      };
    }
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

// 支援アプリへの通知送信
const notifySupportApp = async (loginCode, tempPassword, userName) => {
  try {
    // axiosを使用してHTTPリクエストを送信
    const axios = require('axios');
    
    const response = await axios.post('http://localhost:5000/api/remote-support/notify-temp-password', {
      loginCode,
      tempPassword,
      userName,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000 // 5秒のタイムアウト
    });

    if (response.status === 200) {
      console.log('支援アプリへの通知送信成功');
      return true;
    } else {
      console.error('支援アプリへの通知送信失敗:', response.status);
      return false;
    }
  } catch (error) {
    console.error('支援アプリへの通知送信エラー:', error.message);
    return false;
  }
};

// 一時パスワード発行
const issueTemporaryPassword = async (userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザーの存在確認
    const [userRows] = await connection.execute(
      'SELECT id, name, role, login_code FROM user_accounts WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return {
        success: false,
        message: '指定されたユーザーが見つかりません'
      };
    }

    const user = userRows[0];

    // 利用者（ロール1）のみ対象
    if (user.role !== 1) {
      return {
        success: false,
        message: '利用者のみ一時パスワードを発行できます'
      };
    }

    // 既存の一時パスワードを無効化
    await connection.execute(
      'UPDATE user_temp_passwords SET is_used = 1 WHERE user_id = ? AND is_used = 0',
      [userId]
    );
    
    // 新しい一時パスワードを生成
    const tempPassword = generateTemporaryPassword();
    const expiryTime = getTodayEndTime();
    
    // 新しい一時パスワードを登録
    await connection.execute(
      'INSERT INTO user_temp_passwords (user_id, temp_password, expires_at) VALUES (?, ?, ?)',
      [userId, tempPassword, expiryTime]
    );

    // 支援アプリに通知を送信（非同期で実行）
    notifySupportApp(user.login_code, tempPassword, user.name)
      .then(success => {
        if (success) {
          console.log(`支援アプリへの通知送信完了: ${user.name}`);
        } else {
          console.warn(`支援アプリへの通知送信失敗: ${user.name}`);
        }
      })
      .catch(error => {
        console.error(`支援アプリへの通知送信エラー: ${user.name}`, error);
      });

    return {
      success: true,
      message: '一時パスワードが発行されました',
      data: {
        tempPassword,
        expiresAt: expiryTime,
        loginUrl: `http://localhost:3000/student-login?code=${user.login_code}`,
        userName: user.name
      }
    };
  } catch (error) {
    console.error('Error issuing temporary password:', error);
    return {
      success: false,
      message: '一時パスワードの発行に失敗しました',
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

// 一時パスワード検証
const verifyTemporaryPassword = async (loginCode, tempPassword) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // ユーザーと一時パスワードの存在確認
    const [rows] = await connection.execute(`
      SELECT 
        ua.id, 
        ua.name, 
        ua.role,
        utp.temp_password,
        utp.expires_at,
        utp.is_used
      FROM user_accounts ua
      JOIN user_temp_passwords utp ON ua.id = utp.user_id
      WHERE ua.login_code = ? AND utp.temp_password = ?
      ORDER BY utp.issued_at DESC
      LIMIT 1
    `, [loginCode, tempPassword]);

    if (rows.length === 0) {
      return {
        success: false,
        message: 'ログインコードまたはパスワードが正しくありません'
      };
    }

    const user = rows[0];

    // 有効期限チェック
    if (!isPasswordValid(user.expires_at)) {
      return {
        success: false,
        message: 'パスワードの有効期限が切れています'
      };
    }

    // 使用済みチェック
    if (user.is_used) {
      return {
        success: false,
        message: 'このパスワードは既に使用されています'
      };
    }

    // パスワードを使用済みにマーク
    await connection.execute(
      'UPDATE user_temp_passwords SET is_used = 1, used_at = NOW() WHERE user_id = ? AND temp_password = ?',
      [user.id, tempPassword]
    );

    return {
      success: true,
      message: 'ログインに成功しました',
      data: {
        userId: user.id,
        userName: user.name,
        role: user.role
      }
    };
  } catch (error) {
    console.error('Error verifying temporary password:', error);
    return {
      success: false,
      message: 'パスワード検証に失敗しました',
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

// 指導員のパスワード変更
const changeInstructorPassword = async (userId, currentPassword, newPassword) => {
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

    // 現在のパスワードを確認
    const [credentialRows] = await connection.execute(
      'SELECT password_hash FROM admin_credentials WHERE user_id = ?',
      [userId]
    );

    if (credentialRows.length === 0) {
      return {
        success: false,
        message: '認証情報が見つかりません'
      };
    }

    const isValidPassword = await bcrypt.compare(currentPassword, credentialRows[0].password_hash);
    if (!isValidPassword) {
      return {
        success: false,
        message: '現在のパスワードが正しくありません'
      };
    }

    // 新しいパスワードをハッシュ化
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // パスワードを更新
    await connection.execute(
      'UPDATE admin_credentials SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
      [newPasswordHash, userId]
    );

    // パスワード変更要求フラグをクリア
    await connection.execute(
      'UPDATE user_accounts SET password_reset_required = 0 WHERE id = ?',
      [userId]
    );

    return {
      success: true,
      message: 'パスワードが正常に変更されました'
    };
  } catch (error) {
    console.error('Error changing instructor password:', error);
    return {
      success: false,
      message: 'パスワードの変更に失敗しました',
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

// ログインコード更新
const updateLoginCodes = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('=== ログインコード更新開始 ===');
    
    // 古い形式のログインコードを持つユーザーを取得
    const [users] = await connection.execute(`
      SELECT id, name, login_code 
      FROM user_accounts 
      WHERE login_code LIKE 'token%' OR login_code NOT LIKE '%-%-%'
    `);
    
    console.log(`更新対象ユーザー数: ${users.length}`);
    
    const updatedUsers = [];
    
    if (users.length > 0) {
      // 各ユーザーのログインコードを更新
      for (const user of users) {
        const newLoginCode = generateLoginCode();
        
        console.log(`ユーザー ${user.name} (ID: ${user.id}) のログインコードを更新:`);
        console.log(`  古い形式: ${user.login_code}`);
        console.log(`  新しい形式: ${newLoginCode}`);
        
        await connection.execute(
          'UPDATE user_accounts SET login_code = ? WHERE id = ?',
          [newLoginCode, user.id]
        );
        
        updatedUsers.push({
          id: user.id,
          name: user.name,
          oldLoginCode: user.login_code,
          newLoginCode: newLoginCode
        });
        
        console.log(`  ✅ 更新完了`);
      }
    }
    
    console.log('=== ログインコード更新完了 ===');
    
    return {
      success: true,
      message: `${updatedUsers.length}件のログインコードを更新しました`,
      data: {
        updatedCount: updatedUsers.length,
        updatedUsers: updatedUsers
      }
    };
    
  } catch (error) {
    console.error('ログインコード更新エラー:', error);
    return {
      success: false,
      message: 'ログインコードの更新に失敗しました',
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

// 指導員の専門分野を取得
const getInstructorSpecializations = async (userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(
      'SELECT id, specialization, created_at, updated_at FROM instructor_specializations WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('Error fetching instructor specializations:', error);
    return {
      success: false,
      message: '専門分野の取得に失敗しました',
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

// 指導員の専門分野を追加
const addInstructorSpecialization = async (userId, specialization) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(
      'INSERT INTO instructor_specializations (user_id, specialization) VALUES (?, ?)',
      [userId, specialization]
    );

    return {
      success: true,
      message: '専門分野が追加されました',
      data: {
        id: result.insertId
      }
    };
  } catch (error) {
    console.error('Error adding instructor specialization:', error);
    return {
      success: false,
      message: '専門分野の追加に失敗しました',
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

// 指導員の専門分野を更新
const updateInstructorSpecialization = async (specializationId, specialization) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(
      'UPDATE instructor_specializations SET specialization = ?, updated_at = NOW() WHERE id = ?',
      [specialization, specializationId]
    );

    if (result.affectedRows === 0) {
      return {
        success: false,
        message: '指定された専門分野が見つかりません'
      };
    }

    return {
      success: true,
      message: '専門分野が更新されました'
    };
  } catch (error) {
    console.error('Error updating instructor specialization:', error);
    return {
      success: false,
      message: '専門分野の更新に失敗しました',
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

// 指導員の専門分野を削除
const deleteInstructorSpecialization = async (specializationId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(
      'DELETE FROM instructor_specializations WHERE id = ?',
      [specializationId]
    );

    if (result.affectedRows === 0) {
      return {
        success: false,
        message: '指定された専門分野が見つかりません'
      };
    }

    return {
      success: true,
      message: '専門分野が削除されました'
    };
  } catch (error) {
    console.error('Error deleting instructor specialization:', error);
    return {
      success: false,
      message: '専門分野の削除に失敗しました',
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

/**
 * 拠点内の利用者と担当指導員の関係を取得
 */
const getSatelliteUserInstructorRelations = async (satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.instructor_id,
        i.name as instructor_name,
        u.status as user_status
      FROM user_accounts u
      LEFT JOIN user_accounts i ON u.instructor_id = i.id
      WHERE u.role = 1 
        AND JSON_CONTAINS(u.satellite_ids, ?)
        AND u.status = 1
      ORDER BY u.name
    `, [JSON.stringify(satelliteId)]);
    
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('拠点利用者担当指導員関係取得エラー:', error);
    return {
      success: false,
      message: '拠点利用者担当指導員関係の取得に失敗しました',
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

/**
 * 拠点内の指導員一覧を取得（担当指導員として選択可能）
 */
const getSatelliteAvailableInstructors = async (satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        u.id,
        u.name,
        u.role,
        u.status
      FROM user_accounts u
      WHERE (u.role = 4 OR u.role = 5)
        AND JSON_CONTAINS(u.satellite_ids, ?)
        AND u.status = 1
      ORDER BY u.name
    `, [JSON.stringify(satelliteId)]);
    
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('拠点利用可能指導員取得エラー:', error);
    return {
      success: false,
      message: '拠点利用可能指導員の取得に失敗しました',
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

/**
 * 個別利用者の担当指導員を変更
 */
const updateUserInstructor = async (userId, instructorId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 利用者の存在確認
    const [userRows] = await connection.execute(
      'SELECT id, name, role FROM user_accounts WHERE id = ? AND role = 1',
      [userId]
    );
    
    if (userRows.length === 0) {
      return {
        success: false,
        message: '指定された利用者が見つかりません'
      };
    }
    
    // 指導員の存在確認（instructorIdがnullの場合はスキップ）
    if (instructorId !== null) {
      const [instructorRows] = await connection.execute(
        'SELECT id, name, role FROM user_accounts WHERE id = ? AND (role = 4 OR role = 5)',
        [instructorId]
      );
      
      if (instructorRows.length === 0) {
        return {
          success: false,
          message: '指定された指導員が見つかりません'
        };
      }
    }
    
    // 担当指導員を更新
    await connection.execute(
      'UPDATE user_accounts SET instructor_id = ? WHERE id = ?',
      [instructorId, userId]
    );
    
    return {
      success: true,
      message: '担当指導員を更新しました'
    };
  } catch (error) {
    console.error('担当指導員更新エラー:', error);
    return {
      success: false,
      message: '担当指導員の更新に失敗しました',
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

/**
 * 一括で利用者の担当指導員を変更
 */
const bulkUpdateUserInstructors = async (satelliteId, assignments) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // トランザクション開始
    await connection.beginTransaction();
    
    // 拠点内の利用者一覧を取得
    const [userRows] = await connection.execute(`
      SELECT id, name FROM user_accounts 
      WHERE role = 1 
        AND JSON_CONTAINS(satellite_ids, ?)
        AND status = 1
    `, [JSON.stringify(satelliteId)]);
    
    const validUserIds = userRows.map(row => row.id);
    
    // 利用可能な指導員一覧を取得
    const [instructorRows] = await connection.execute(`
      SELECT id, name FROM user_accounts 
      WHERE (role = 4 OR role = 5)
        AND JSON_CONTAINS(satellite_ids, ?)
        AND status = 1
    `, [JSON.stringify(satelliteId)]);
    
    const validInstructorIds = instructorRows.map(row => row.id);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // 各割り当てを処理
    for (const assignment of assignments) {
      try {
        // 利用者IDの妥当性チェック
        if (!validUserIds.includes(assignment.userId)) {
          errors.push(`利用者ID ${assignment.userId} が見つかりません`);
          errorCount++;
          continue;
        }
        
        // 指導員IDの妥当性チェック（nullの場合はスキップ）
        if (assignment.instructorId !== null && !validInstructorIds.includes(assignment.instructorId)) {
          errors.push(`指導員ID ${assignment.instructorId} が見つかりません`);
          errorCount++;
          continue;
        }
        
        // 担当指導員を更新
        await connection.execute(
          'UPDATE user_accounts SET instructor_id = ? WHERE id = ?',
          [assignment.instructorId, assignment.userId]
        );
        
        successCount++;
      } catch (error) {
        errors.push(`利用者ID ${assignment.userId} の更新に失敗: ${error.message}`);
        errorCount++;
      }
    }
    
    // トランザクションをコミット
    await connection.commit();
    
    return {
      success: true,
      message: `一括更新が完了しました（成功: ${successCount}件、失敗: ${errorCount}件）`,
      data: {
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined
      }
    };
  } catch (error) {
    // トランザクションをロールバック
    if (connection) {
      await connection.rollback();
    }
    
    console.error('一括担当指導員更新エラー:', error);
    return {
      success: false,
      message: '一括担当指導員更新に失敗しました',
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

/**
 * 拠点内の全利用者の担当指導員を一括削除
 */
const bulkRemoveUserInstructors = async (satelliteId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 拠点内の利用者の担当指導員を一括削除
    const [result] = await connection.execute(`
      UPDATE user_accounts 
      SET instructor_id = NULL 
      WHERE role = 1 
        AND JSON_CONTAINS(satellite_ids, ?)
        AND status = 1
    `, [JSON.stringify(satelliteId)]);
    
    return {
      success: true,
      message: `${result.affectedRows}件の利用者の担当指導員を削除しました`,
      data: {
        affectedRows: result.affectedRows
      }
    };
  } catch (error) {
    console.error('一括担当指導員削除エラー:', error);
    return {
      success: false,
      message: '一括担当指導員削除に失敗しました',
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

/**
 * 拠点内の通所利用者一覧を取得（在宅支援追加用）
 */
const getSatelliteUsersForHomeSupport = async (req, res) => {
  const { satelliteId } = req.params;
  const { instructorIds } = req.query;
  const connection = await pool.getConnection();
  
  try {
    let query = `
      SELECT 
        ua.id,
        ua.name,
        ua.login_code,
        CASE WHEN ua.is_remote_user = 1 THEN true ELSE false END as is_remote_user,
        ua.instructor_id,
        instructor.name as instructor_name,
        ua.company_id,
        c.name as company_name
      FROM user_accounts ua
      LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.role = 1 
        AND JSON_CONTAINS(ua.satellite_ids, ?)
        AND ua.status = 1
        AND ua.is_remote_user = 0
    `;
    
    const params = [JSON.stringify(parseInt(satelliteId))];
    
    // 特定の指導員の利用者のみを取得する場合
    if (instructorIds) {
      const instructorIdArray = instructorIds.split(',').map(id => parseInt(id.trim()));
      query += ` AND (ua.instructor_id IN (${instructorIdArray.map(() => '?').join(',')}) OR ua.instructor_id IS NULL)`;
      params.push(...instructorIdArray);
    }
    
    query += ` ORDER BY ua.instructor_id, ua.name`;
    
    const [rows] = await connection.execute(query, params);
    
    customLogger.info('Satellite users for home support retrieved successfully', {
      satelliteId,
      instructorIds,
      count: rows.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Error fetching satellite users for home support:', error);
    res.status(500).json({
      success: false,
      message: '拠点利用者の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 在宅支援フラグを一括更新
 */
const bulkUpdateHomeSupportFlag = async (req, res) => {
  const { userIds, isRemoteUser } = req.body;
  const connection = await pool.getConnection();
  
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '利用者IDの配列が必要です'
      });
    }
    
    const [result] = await connection.execute(`
      UPDATE user_accounts 
      SET is_remote_user = ?
      WHERE id IN (${userIds.map(() => '?').join(',')})
        AND role = 1
    `, [isRemoteUser ? 1 : 0, ...userIds]);
    
    customLogger.info('Home support flag updated successfully', {
      userIds,
      isRemoteUser,
      affectedRows: result.affectedRows,
      updatedBy: req.user?.user_id
    });

    res.json({
      success: true,
      message: `${result.affectedRows}名の利用者の在宅支援フラグを更新しました`,
      data: {
        affectedRows: result.affectedRows
      }
    });
  } catch (error) {
    customLogger.error('Error updating home support flag:', error);
    res.status(500).json({
      success: false,
      message: '在宅支援フラグの更新に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 拠点内の在宅支援利用者一覧を取得
 */
const getSatelliteHomeSupportUsers = async (req, res) => {
  const { satelliteId } = req.params;
  const { instructorIds } = req.query;
  const connection = await pool.getConnection();
  
  try {
    let query = `
      SELECT 
        ua.id,
        ua.name,
        ua.login_code,
        CASE WHEN ua.is_remote_user = 1 THEN true ELSE false END as is_remote_user,
        ua.instructor_id,
        instructor.name as instructor_name,
        ua.company_id,
        c.name as company_name
      FROM user_accounts ua
      LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.role = 1 
        AND JSON_CONTAINS(ua.satellite_ids, ?)
        AND ua.status = 1
        AND ua.is_remote_user = 1
    `;
    
    const params = [JSON.stringify(parseInt(satelliteId))];
    
    // 特定の指導員の利用者のみを取得する場合
    if (instructorIds) {
      const instructorIdArray = instructorIds.split(',').map(id => parseInt(id.trim()));
      query += ` AND (ua.instructor_id IN (${instructorIdArray.map(() => '?').join(',')}) OR ua.instructor_id IS NULL)`;
      params.push(...instructorIdArray);
    }
    
    query += ` ORDER BY ua.instructor_id, ua.name`;
    
    const [rows] = await connection.execute(query, params);
    
    customLogger.info('Satellite home support users retrieved successfully', {
      satelliteId,
      instructorIds,
      count: rows.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Error fetching satellite home support users:', error);
    res.status(500).json({
      success: false,
      message: '在宅支援利用者の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 在宅支援解除（単一利用者）
 */
const removeHomeSupportFlag = async (req, res) => {
  const { userId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // 現在のタグを取得
    const [currentUser] = await connection.execute(`
      SELECT tags FROM user_accounts WHERE id = ? AND role = 1
    `, [userId]);
    
    if (currentUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '指定された利用者が見つからないか、在宅支援対象ではありません'
      });
    }
    
    // 現在のタグを解析
    let currentTags = [];
    if (currentUser[0].tags) {
      try {
        currentTags = JSON.parse(currentUser[0].tags);
      } catch (e) {
        currentTags = [];
      }
    }
    
    // 「在宅支援」タグを削除
    const updatedTags = currentTags.filter(tag => tag !== '在宅支援');
    
    // 在宅支援フラグを解除し、タグも更新
    const [result] = await connection.execute(`
      UPDATE user_accounts 
      SET is_remote_user = 0, tags = ?
      WHERE id = ? AND role = 1
    `, [JSON.stringify(updatedTags), userId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '指定された利用者が見つからないか、在宅支援対象ではありません'
      });
    }
    
    customLogger.info('Home support flag and tag removed successfully', {
      userId,
      affectedRows: result.affectedRows,
      updatedTags,
      updatedBy: req.user?.user_id
    });

    res.json({
      success: true,
      message: '在宅支援を解除しました',
      data: {
        affectedRows: result.affectedRows,
        updatedTags
      }
    });
  } catch (error) {
    customLogger.error('Error removing home support flag:', error);
    res.status(500).json({
      success: false,
      message: '在宅支援解除に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 拠点内の指導員一覧を取得（在宅支援用）
 */
const getSatelliteInstructorsForHomeSupport = async (req, res) => {
  const { satelliteId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT DISTINCT
        ua.id,
        ua.name,
        ua.login_code,
        COUNT(students.id) as student_count
      FROM user_accounts ua
      LEFT JOIN user_accounts students ON ua.id = students.instructor_id 
        AND students.role = 1 
        AND JSON_CONTAINS(students.satellite_ids, ?)
        AND students.status = 1
      WHERE ua.role = 4 
        AND JSON_CONTAINS(ua.satellite_ids, ?)
        AND ua.status = 1
      GROUP BY ua.id, ua.name, ua.login_code
      ORDER BY ua.name
    `, [JSON.stringify(parseInt(satelliteId)), JSON.stringify(parseInt(satelliteId))]);
    
    customLogger.info('Satellite instructors for home support retrieved successfully', {
      satelliteId,
      count: rows.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Error fetching satellite instructors for home support:', error);
    res.status(500).json({
      success: false,
      message: '拠点指導員の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
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
  deleteUser,
  resetUserPassword,
  changeInstructorPassword,
  issueTemporaryPassword,
  verifyTemporaryPassword,
  updateLoginCodes,
  generateLoginCode,
  getInstructorSpecializations,
  addInstructorSpecialization,
  updateInstructorSpecialization,
  deleteInstructorSpecialization,
  getSatelliteUserInstructorRelations,
  getSatelliteAvailableInstructors,
  updateUserInstructor,
  bulkUpdateUserInstructors,
  bulkRemoveUserInstructors,
  getSatelliteUsersForHomeSupport,
  getSatelliteHomeSupportUsers,
  bulkUpdateHomeSupportFlag,
  removeHomeSupportFlag,
  getSatelliteInstructorsForHomeSupport
}; 