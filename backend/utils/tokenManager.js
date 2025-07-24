const jwt = require('jsonwebtoken');
const { pool } = require('./database');

// JWT設定
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = '10m'; // 10分
const REFRESH_TOKEN_EXPIRY = '10m'; // 10分

// アクセストークン生成
const generateAccessToken = (userData) => {
  return jwt.sign(
    {
      user_id: userData.user_id,
      username: userData.user_name,
      role: userData.role,
      company_id: userData.company_id
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

// リフレッシュトークン生成
const generateRefreshToken = (userData) => {
  return jwt.sign(
    {
      user_id: userData.user_id,
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
};

// トークン検証
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// リフレッシュトークンをデータベースに保存
const saveRefreshToken = async (userId, refreshToken) => {
  try {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 10 * 60 * 1000); // 10分後

    await pool.execute(`
      INSERT INTO refresh_tokens (user_id, token, issued_at, expires_at)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        token = VALUES(token),
        issued_at = VALUES(issued_at),
        expires_at = VALUES(expires_at)
    `, [userId, refreshToken, issuedAt, expiresAt]);

    return true;
  } catch (error) {
    console.error('Error saving refresh token:', error);
    return false;
  }
};

// リフレッシュトークンをデータベースから検証
const verifyRefreshToken = async (refreshToken) => {
  try {
    // JWTの検証
    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return null;
    }

    // データベースでの検証
    const [rows] = await pool.execute(`
      SELECT rt.*, ua.status as user_status
      FROM refresh_tokens rt
      JOIN user_accounts ua ON rt.user_id = ua.id
      WHERE rt.token = ? AND rt.expires_at > NOW()
    `, [refreshToken]);

    if (rows.length === 0) {
      return null;
    }

    const tokenData = rows[0];

    // ユーザーが停止または削除されているかチェック
    if (tokenData.user_status !== 1) {
      // トークンを削除
      await pool.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
      return null;
    }

    return {
      user_id: tokenData.user_id,
      issued_at: tokenData.issued_at,
      expires_at: tokenData.expires_at
    };
  } catch (error) {
    console.error('Error verifying refresh token:', error);
    return null;
  }
};

// リフレッシュトークンを削除
const deleteRefreshToken = async (refreshToken) => {
  try {
    await pool.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    return true;
  } catch (error) {
    console.error('Error deleting refresh token:', error);
    return false;
  }
};

// ユーザーの全リフレッシュトークンを削除
const deleteAllUserRefreshTokens = async (userId) => {
  try {
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    return true;
  } catch (error) {
    console.error('Error deleting user refresh tokens:', error);
    return false;
  }
};

// 期限切れのトークンを削除
const cleanupExpiredTokens = async () => {
  try {
    await pool.execute('DELETE FROM refresh_tokens WHERE expires_at <= NOW()');
    return true;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return false;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  saveRefreshToken,
  verifyRefreshToken,
  deleteRefreshToken,
  deleteAllUserRefreshTokens,
  cleanupExpiredTokens,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY
}; 