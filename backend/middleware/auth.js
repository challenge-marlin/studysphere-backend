const { verifyToken } = require('../utils/tokenManager');

/**
 * SERVICE_TOKENを検証
 * 外部システム（findjob等）からSSOチケット生成APIを呼び出す際に使用
 * @param {string} token - 検証するトークン
 * @returns {boolean} 有効な場合true
 */
function verifyServiceToken(token) {
  const serviceToken = process.env.SERVICE_TOKEN;
  if (!serviceToken) {
    return false;
  }
  return token === serviceToken;
}

// JWT認証ミドルウェア（SERVICE_TOKENもサポート）
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('認証ミドルウェア: リクエスト受信', {
      url: req.url,
      method: req.method,
      query: req.query,
      hasAuthHeader: !!authHeader,
      hasToken: !!token,
      tokenLength: token ? token.length : 0
    });

    if (!token) {
      console.log('認証ミドルウェア: トークンが提供されていません');
      console.log('リクエストURL:', req.url);
      console.log('リクエストメソッド:', req.method);
      console.log('リクエストヘッダー:', req.headers);
      return res.status(401).json({
        success: false,
        message: 'アクセストークンが提供されていません'
      });
    }

    // SERVICE_TOKENのチェック（外部システムからのSSOチケット生成用）
    if (verifyServiceToken(token)) {
      console.log('認証ミドルウェア: SERVICE_TOKEN認証を検出');
      
      // SERVICE_TOKEN認証の場合、リクエストボディからuser_idを取得
      // これは外部システム（findjob等）からSSOチケット生成する際に使用
      const userId = req.body?.user_id;
      
      if (!userId) {
        console.log('認証ミドルウェア: SERVICE_TOKEN認証ですが、user_idが提供されていません');
        return res.status(400).json({
          success: false,
          message: 'SERVICE_TOKEN認証の場合、user_idが必要です'
        });
      }

      // SERVICE_TOKEN認証用のユーザー情報を設定
      // 外部システムからのリクエストなので、最小限の情報のみ設定
      req.user = {
        user_id: userId,
        role: 10, // マスターユーザーとして扱う（SSOチケット生成のため）
        is_service_token: true // SERVICE_TOKEN認証フラグ
      };

      console.log('認証ミドルウェア: SERVICE_TOKEN認証成功', {
        userId: req.user.user_id,
        isServiceToken: true
      });

      next();
      return;
    }

    // JWT認証の処理
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

    console.log('認証ミドルウェア: JWT認証成功', {
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

// 管理者権限チェックミドルウェア（ロール9以上）
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