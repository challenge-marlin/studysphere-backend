const { verifyToken } = require('../utils/tokenManager');

// JWT認証ミドルウェア
const authenticateToken = (req, res, next) => {
  try {
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

    // トークンの有効期限をチェック
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({
        success: false,
        message: 'トークンの有効期限が切れています'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('認証ミドルウェアエラー:', error);
    return res.status(500).json({
      success: false,
      message: '認証処理中にエラーが発生しました'
    });
  }
};

// 管理者権限チェックミドルウェア
const requireAdmin = (req, res, next) => {
  try {
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
  } catch (error) {
    console.error('管理者権限チェックエラー:', error);
    return res.status(500).json({
      success: false,
      message: '権限チェック中にエラーが発生しました'
    });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin
}; 