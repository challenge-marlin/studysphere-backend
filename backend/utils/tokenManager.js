const jwt = require('jsonwebtoken');
const { pool } = require('./database');

// JWT設定
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = '10m'; // 10分
const REFRESH_TOKEN_EXPIRY = '10m'; // 10分

// トークンキャッシュ（メモリリークを防ぐため制限付き）
const tokenCache = new Map();
const MAX_CACHE_SIZE = 1000; // 最大キャッシュサイズ

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
  let connection;
  try {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 10 * 60 * 1000); // 10分後

    connection = await pool.getConnection();
    await connection.execute(`
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
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// リフレッシュトークンをデータベースから検証
const verifyRefreshToken = async (refreshToken) => {
  let connection;
  try {
    // JWTの検証
    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return null;
    }

    // データベースでの検証
    connection = await pool.getConnection();
    const [rows] = await connection.execute(`
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
      await connection.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
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
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// リフレッシュトークンを削除
const deleteRefreshToken = async (refreshToken) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    return true;
  } catch (error) {
    console.error('Error deleting refresh token:', error);
    return false;
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// ユーザーの全リフレッシュトークンを削除
const deleteAllUserRefreshTokens = async (userId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    return true;
  } catch (error) {
    console.error('Error deleting user refresh tokens:', error);
    return false;
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// 期限切れのトークンを削除
const cleanupExpiredTokens = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.execute('DELETE FROM refresh_tokens WHERE expires_at <= NOW()');
    console.log(`期限切れトークンを${result.affectedRows}件削除しました`);
    return true;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return false;
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
};

// トークンキャッシュのクリーンアップ
const cleanupTokenCache = () => {
  try {
    const now = Date.now();
    for (const [key, value] of tokenCache.entries()) {
      if (value.expiresAt && value.expiresAt < now) {
        tokenCache.delete(key);
      }
    }
    
    // キャッシュサイズが上限を超えた場合、古いエントリを削除
    if (tokenCache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(tokenCache.entries());
      entries.sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
      
      const deleteCount = tokenCache.size - MAX_CACHE_SIZE;
      for (let i = 0; i < deleteCount; i++) {
        tokenCache.delete(entries[i][0]);
      }
    }
  } catch (error) {
    console.error('トークンキャッシュのクリーンアップに失敗:', error);
  }
};

/**
 * トークン管理ユーティリティ
 */

/**
 * ランダムなトークンを生成（XXXX-XXXX-XXXX形式）
 * @returns {string} 生成されたトークン
 */
const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  
  // XXXX-XXXX-XXXX形式で生成
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) {
      token += '-';
    }
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return token;
};

/**
 * 契約タイプに基づいて有効期限を計算
 * @param {string} contractType - 契約タイプ ('30days', '90days', '1year')
 * @returns {Date} 有効期限の日付
 */
const calculateExpiryDate = (contractType) => {
  const now = new Date();
  
  switch (contractType) {
    case '30days':
      return new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    case '90days':
      return new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
    case '1year':
      return new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
    default:
      throw new Error('無効な契約タイプです');
  }
};

/**
 * トークンが有効かどうかをチェック
 * @param {Date} expiryDate - 有効期限
 * @returns {boolean} 有効かどうか
 */
const isTokenValid = (expiryDate) => {
  const now = new Date();
  return new Date(expiryDate) > now;
};

/**
 * トークンの残り日数を計算
 * @param {Date} expiryDate - 有効期限
 * @returns {number} 残り日数
 */
const getRemainingDays = (expiryDate) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

// 定期的なクリーンアップの実行
// 期限切れトークンの削除（1時間ごと）
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

// トークンキャッシュのクリーンアップ（30分ごと）
setInterval(cleanupTokenCache, 30 * 60 * 1000);

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  console.log('トークンマネージャーを終了しています...');
  tokenCache.clear();
});

process.on('SIGTERM', () => {
  console.log('トークンマネージャーを終了しています...');
  tokenCache.clear();
});

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  saveRefreshToken,
  verifyRefreshToken,
  deleteRefreshToken,
  deleteAllUserRefreshTokens,
  cleanupExpiredTokens,
  cleanupTokenCache,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  generateToken,
  calculateExpiryDate,
  isTokenValid,
  getRemainingDays
}; 