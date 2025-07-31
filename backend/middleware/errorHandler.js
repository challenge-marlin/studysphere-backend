const { customLogger } = require('../utils/logger');

// エラーハンドリングミドルウェア
const errorHandler = (err, req, res, next) => {
  // エラーの詳細ログ
  customLogger.errorWithStack(err, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.headers['x-request-id'],
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  res.status(500).json({
    success: false,
    message: 'サーバーエラーが発生しました',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// 404ハンドラー
const notFoundHandler = (req, res) => {
  // 404エラーのログ
  customLogger.warn('404 Not Found', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({
    success: false,
    message: 'エンドポイントが見つかりません'
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
}; 