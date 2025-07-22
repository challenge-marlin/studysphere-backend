require('dotenv').config();
const app = require('./app');

const port = process.env.PORT || 5000;

// サーバー起動
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Database:', process.env.DB_NAME || 'curriculum-portal');
}); 