const { pool } = require('../utils/database');

// ユーザー一覧取得
const getUsers = async () => {
  try {
    const [rows] = await pool.execute('SELECT * FROM user_accounts');
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
  }
};

// 企業別最上位ユーザー取得
const getTopUsersByCompany = async () => {
  try {
    const query = `
      SELECT 
        c.id as company_id,
        c.name as company_name,
        ua.id as user_id,
        ua.name as user_name,
        ua.role,
        ua.satellite_id
      FROM companies c
      LEFT JOIN user_accounts ua ON c.id = ua.company_id
      WHERE ua.role = (
        SELECT MAX(role) 
        FROM user_accounts ua2 
        WHERE ua2.company_id = c.id
      )
      ORDER BY c.id, ua.role DESC, ua.id
    `;
    
    const [rows] = await pool.execute(query);
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
  }
};

// 企業別ロール4以上のユーザー数取得
const getTeachersByCompany = async () => {
  try {
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
    
    const [rows] = await pool.execute(query);
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
  }
};

// ヘルスチェック
const healthCheck = async () => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT NOW() as current_datetime');
    const currentTime = rows[0].current_datetime;
    connection.release();
    
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
  }
};

module.exports = {
  getUsers,
  getTopUsersByCompany,
  getTeachersByCompany,
  healthCheck
}; 