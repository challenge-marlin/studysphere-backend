const { verifyToken } = require('../utils/tokenManager');

// JWT認証ミドルウェア
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('認証ミドルウェア: リクエスト受信', {
      url: req.url,
      method: req.method,
      hasAuthHeader: !!authHeader,
      hasToken: !!token,
      tokenLength: token ? token.length : 0
    });

    if (!token) {
      console.log('認証ミドルウェア: トークンが提供されていません');
      return res.status(401).json({
        success: false,
        message: 'アクセストークンが提供されていません'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      console.log('認証ミドルウェア: 無効なトークン');
      return res.status(403).json({
        success: false,
        message: '無効なトークンです'
      });
    }

    // トークンの有効期限をチェック
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      console.log('認証ミドルウェア: トークンの有効期限が切れています', {
        currentTime: Date.now(),
        expiryTime: decoded.exp * 1000,
        difference: Date.now() - (decoded.exp * 1000)
      });
      return res.status(401).json({
        success: false,
        message: 'トークンの有効期限が切れています'
      });
    }

    console.log('認証ミドルウェア: 認証成功', {
      userId: decoded.user_id,
      role: decoded.role,
      username: decoded.username
    });

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