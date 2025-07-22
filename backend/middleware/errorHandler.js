// エラーハンドリングミドルウェア
const errorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'サーバーエラーが発生しました',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// 404ハンドラー
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'エンドポイントが見つかりません'
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
}; 