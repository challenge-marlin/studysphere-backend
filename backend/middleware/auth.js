const { verifyToken } = require('../utils/tokenManager');

// JWT認証ミドルウェア
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'アクセストークンが提供されていません'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({
      success: false,
      message: '無効なトークンです'
    });
  }

  req.user = decoded;
  next();
};

// 管理者権限チェックミドルウェア
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '認証が必要です'
    });
  }

  if (req.user.role < 9) {
    return res.status(403).json({
      success: false,
      message: '管理者権限が必要です'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireAdmin
}; 