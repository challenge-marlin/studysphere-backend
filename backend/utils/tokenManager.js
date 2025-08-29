const jwt = require('jsonwebtoken');
const { pool } = require('./database');
const { 
  getCurrentJapanTime, 
  getTodayEndTime, 
  convertUTCToJapanTime, 
  convertJapanTimeToUTC,
  isExpired,
  formatJapanTime 
} = require('./dateUtils');

// JWT設定
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = '1h'; // 1時間に延長

// リフレッシュトークンの有効期限を24時間に設定
const getRefreshTokenExpiry = () => {
  // 24時間の有効期限を設定
  const expirySeconds = 24 * 60 * 60; // 24時間
  
  console.log('リフレッシュトークン有効期限計算:', {
    expirySeconds,
    remainingHours: Math.floor(expirySeconds / 3600)
  });
  
  return `${expirySeconds}s`;
};

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
    { expiresIn: getRefreshTokenExpiry() }
  );
};

// トークン検証
const verifyToken = (token) => {
  try {
    if (!token || typeof token !== 'string') {
      console.warn('トークン検証: 無効なトークン形式');
      return null;
    }

    // JWT形式のチェック（3つの部分に分割されているか）
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('トークン検証: JWT形式が不正');
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // デコードされたトークンの基本チェック
    if (!decoded || typeof decoded !== 'object') {
      console.warn('トークン検証: デコード結果が無効');
      return null;
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.warn('トークン検証: トークンの有効期限が切れています');
    } else if (error.name === 'JsonWebTokenError') {
      console.warn('トークン検証: JWT形式が不正です');
    } else if (error.name === 'NotBeforeError') {
      console.warn('トークン検証: トークンがまだ有効になっていません');
    } else {
      console.error('トークン検証エラー:', error.message);
    }
    return null;
  }
};

// リフレッシュトークンをデータベースに保存
const saveRefreshToken = async (userId, refreshToken) => {
  let connection;
  try {
    const issuedAt = new Date();
    const expiresAt = getTodayEndTime();

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
 * 契約タイプに基づいて有効期限を計算（日本時間）
 * @param {string} contractType - 契約タイプ ('30days', '90days', '1year')
 * @returns {Date} 有効期限の日付（日本時間）
 */
const calculateExpiryDate = (contractType) => {
  // 現在の日本時間を取得
  const now = new Date();
  const japanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  
  switch (contractType) {
    case '30days':
      return new Date(japanTime.getTime() + (30 * 24 * 60 * 60 * 1000));
    case '90days':
      return new Date(japanTime.getTime() + (90 * 24 * 60 * 60 * 1000));
    case '1year':
      return new Date(japanTime.getTime() + (365 * 24 * 60 * 60 * 1000));
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
  getRefreshTokenExpiry,
  generateToken,
  calculateExpiryDate,
  isTokenValid,
  getRemainingDays
}; 