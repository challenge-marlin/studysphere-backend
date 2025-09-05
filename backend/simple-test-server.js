const express = require('express');
const app = express();

// 基本的なミドルウェア
app.use(express.json());

// すべてのリクエストをログ出力
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// ルートエンドポイント
app.get('/', (req, res) => {
  console.log('Root endpoint called');
  res.json({ message: 'Simple test server is running', timestamp: new Date().toISOString() });
});

// ログインエンドポイント
app.post('/api/login', (req, res) => {
  console.log('Login endpoint called');
  console.log('Request body:', req.body);
  res.json({ 
    success: true, 
    message: 'Login endpoint reached', 
    data: req.body,
    timestamp: new Date().toISOString()
  });
});

const port = 5050;
app.listen(port, '0.0.0.0', () => {
  console.log(`Simple test server is running on http://localhost:${port}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});
