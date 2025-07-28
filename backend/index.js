require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./utils/database');

const port = process.env.PORT || 5000;

// データベース接続を確認してからサーバーを起動
const startServer = async () => {
  try {
    console.log('Checking database connection...');
    const dbTest = await testConnection();
    
    if (!dbTest.success) {
      console.error('Database connection failed:', dbTest.error);
      process.exit(1);
    }
    
    console.log('Database connection successful:', dbTest.currentTime);
    
    // サーバー起動
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on http://localhost:${port}`);
      console.log('Environment:', process.env.NODE_ENV || 'development');
      console.log('Database:', process.env.DB_NAME || 'curriculum-portal');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 