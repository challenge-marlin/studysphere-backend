const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');

// MySQL接続プールの作成
const pool = mysql.createPool(dbConfig);

// データベース接続テスト
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT NOW() as current_datetime');
    connection.release();
    return {
      success: true,
      currentTime: rows[0].current_datetime
    };
  } catch (error) {
    console.error('Database connection test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 接続プールの取得
const getPool = () => pool;

module.exports = {
  pool,
  testConnection,
  getPool
}; 