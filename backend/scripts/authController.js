const bcrypt = require('bcryptjs');
const { pool } = require('../utils/database');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  saveRefreshToken,
  verifyRefreshToken,
  deleteRefreshToken,
  deleteAllUserRefreshTokens
} = require('../utils/tokenManager');

// 管理者ログイン処理
const adminLogin = async (username, password) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 管理者認証情報を取得
    const [adminRows] = await connection.execute(`
      SELECT 
        ac.id,
        ac.user_id,
        ac.username,
        ac.password_hash,
        ua.name as user_name,
        ua.login_code,
        ua.role,
        ua.company_id,
        ua.status,
        COALESCE(c.name, 'システム管理者') as company_name
      FROM admin_credentials ac
      JOIN user_accounts ua ON ac.user_id = ua.id
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ac.username = ? 
        AND ua.status = 1
        AND ua.role >= 5
    `, [username]);

    if (adminRows.length === 0) {
      return {
        success: false,
        statusCode: 401,
        message: 'ユーザー名またはパスワードが正しくありません'
      };
    }

    const admin = adminRows[0];

    // パスワードの検証
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      return {
        success: false,
        statusCode: 401,
        message: 'ユーザー名またはパスワードが正しくありません'
      };
    }

    // 最終ログイン日時を更新
    await connection.execute(
      'UPDATE admin_credentials SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
      [admin.id]
    );

    // 既存のリフレッシュトークンを削除
    await deleteAllUserRefreshTokens(admin.user_id);

    // トークン生成
    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);

    // リフレッシュトークンをデータベースに保存
    await saveRefreshToken(admin.user_id, refreshToken);

    // レスポンスデータ（パスワードハッシュは除外）
    const responseData = {
      user_id: admin.user_id,
      user_name: admin.user_name,            // ユーザー名
      company_name: admin.company_name,      // 所属企業名
      login_code: admin.login_code,
      role: admin.role,
      company_id: admin.company_id,
      access_token: accessToken,
      refresh_token: refreshToken
    };

    return {
      success: true,
      statusCode: 200,
      message: 'ログインに成功しました',
      data: responseData
    };

  } catch (error) {
    console.error('Admin login error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'サーバーエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
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

// リフレッシュトークン処理
const refreshToken = async (refreshToken) => {
  let connection;
  try {
    // リフレッシュトークンの検証
    const tokenData = await verifyRefreshToken(refreshToken);
    if (!tokenData) {
      return {
        success: false,
        statusCode: 401,
        message: '無効なリフレッシュトークンです'
      };
    }

    connection = await pool.getConnection();
    
    // ユーザー情報を取得
    const [userRows] = await connection.execute(`
      SELECT 
        ua.id as user_id,
        ua.name as user_name,
        ua.login_code,
        ua.role,
        ua.company_id,
        COALESCE(c.name, 'システム管理者') as company_name
      FROM user_accounts ua
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.id = ? AND ua.status = 1
    `, [tokenData.user_id]);

    if (userRows.length === 0) {
      return {
        success: false,
        statusCode: 401,
        message: 'ユーザーが見つかりません'
      };
    }

    const user = userRows[0];

    // 新しいトークンを生成
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // 古いリフレッシュトークンを削除
    await deleteRefreshToken(refreshToken);

    // 新しいリフレッシュトークンを保存
    await saveRefreshToken(user.user_id, newRefreshToken);

    return {
      success: true,
      statusCode: 200,
      message: 'トークンが更新されました',
      data: {
        access_token: newAccessToken,
        refresh_token: newRefreshToken
      }
    };

  } catch (error) {
    console.error('Refresh token error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'サーバーエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
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

// ログアウト処理
const logout = async (refreshToken) => {
  try {
    if (refreshToken) {
      await deleteRefreshToken(refreshToken);
    }

    return {
      success: true,
      statusCode: 200,
      message: 'ログアウトしました'
    };

  } catch (error) {
    console.error('Logout error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'サーバーエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
};

// 管理者アカウント作成（開発用）
const createAdminAccount = async (userData) => {
  let connection;
  try {
    const { user_id, username, password } = userData;
    
    connection = await pool.getConnection();
    
    // パスワードのハッシュ化
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // 管理者認証情報を登録
    const [result] = await connection.execute(`
      INSERT INTO admin_credentials (user_id, username, password_hash)
      VALUES (?, ?, ?)
    `, [user_id, username, passwordHash]);
    
    return {
      success: true,
      message: '管理者アカウントが作成されました',
      id: result.insertId
    };
    
  } catch (error) {
    console.error('Create admin account error:', error);
    return {
      success: false,
      message: '管理者アカウントの作成に失敗しました',
      error: error.message
    };
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

module.exports = {
  adminLogin,
  refreshToken,
  logout,
  createAdminAccount
}; 