const { pool } = require('../utils/database');

// ユーザー一覧取得
const getUsers = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT * FROM user_accounts');
    return {
      success: true,
      data: {
        users: rows,
        count: rows.length
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

module.exports = {
  getUsers,
  getTopUsersByCompany,
  getTeachersByCompany,
  healthCheck,
  getUserSatellites,
  getSatelliteUsers,
  addSatelliteToUser,
  removeSatelliteFromUser
}; 