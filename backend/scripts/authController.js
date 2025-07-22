const bcrypt = require('bcryptjs');
const { pool } = require('../utils/database');

// 管理者ログイン処理
const adminLogin = async (username, password) => {
  try {
    // 管理者認証情報を取得
    const [adminRows] = await pool.execute(`
      SELECT 
        ac.id,
        ac.user_id,
        ac.username,
        ac.password_hash,
        ua.name as user_name,
        ua.login_code,
        ua.role,
        ua.company_id,
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
    await pool.execute(
      'UPDATE admin_credentials SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
      [admin.id]
    );

    // レスポンスデータ（パスワードハッシュは除外）
    const responseData = {
      user_id: admin.user_id,
      user_name: admin.user_name,            // ユーザー名
      company_name: admin.company_name,      // 所属企業名
      login_code: admin.login_code,
      role: admin.role,
      company_id: admin.company_id
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
  }
};

// 管理者アカウント作成（開発用）
const createAdminAccount = async (userData) => {
  try {
    const { user_id, username, password } = userData;
    
    // パスワードのハッシュ化
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // 管理者認証情報を登録
    const [result] = await pool.execute(`
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
  }
};

module.exports = {
  adminLogin,
  createAdminAccount
}; 