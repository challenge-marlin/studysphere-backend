const mysql = require('mysql2/promise');
require('dotenv').config();

// データベース接続設定
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'curriculum-portal',
  port: process.env.DB_PORT || 3306,
  timezone: '+09:00'
};

async function restoreMasterUser() {
  let connection;
  
  try {
    console.log('=== マスターユーザ復旧開始 ===');
    console.log('データベース接続中...');
    
    // データベース接続
    connection = await mysql.createConnection(dbConfig);
    console.log('データベース接続成功');
    
    // 必要なテーブルが存在するかチェック
    console.log('テーブル存在確認中...');
    
    // user_accountsテーブルの存在確認
    const [userAccountsTable] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'user_accounts'
    `, [dbConfig.database]);
    
    if (userAccountsTable[0].count === 0) {
      console.log('user_accountsテーブルが存在しません。作成中...');
      await connection.execute(`
        CREATE TABLE user_accounts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) DEFAULT NULL,
          role TINYINT NOT NULL,
          status TINYINT NOT NULL DEFAULT 1,
          login_code CHAR(14) NOT NULL,
          company_id INT DEFAULT NULL,
          satellite_ids JSON DEFAULT NULL,
          is_remote_user BOOLEAN NOT NULL DEFAULT FALSE,
          recipient_number VARCHAR(30) DEFAULT NULL,
          password_reset_required TINYINT(1) NOT NULL DEFAULT 0,
          instructor_id INT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_login_code (login_code),
          INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('user_accountsテーブルを作成しました');
    }
    
    // admin_credentialsテーブルの存在確認
    const [adminCredentialsTable] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'admin_credentials'
    `, [dbConfig.database]);
    
    if (adminCredentialsTable[0].count === 0) {
      console.log('admin_credentialsテーブルが存在しません。作成中...');
      await connection.execute(`
        CREATE TABLE admin_credentials (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          username VARCHAR(50) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          last_login_at DATETIME DEFAULT NULL,
          UNIQUE KEY unique_user_id (user_id),
          UNIQUE KEY unique_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('admin_credentialsテーブルを作成しました');
    }
    
    // 既存の管理者ユーザーをチェック
    console.log('既存の管理者ユーザーをチェック中...');
    const [existingUser] = await connection.execute(
      'SELECT id, name FROM user_accounts WHERE id = 1'
    );
    
    if (existingUser.length > 0) {
      console.log(`既存の管理者ユーザーが見つかりました: ID=${existingUser[0].id}, 名前=${existingUser[0].name}`);
      
      // 既存ユーザーを更新
      await connection.execute(`
        UPDATE user_accounts 
        SET name = 'マスターユーザ', role = 10, status = 1, login_code = 'ADMN-0001-0001',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `);
      console.log('既存の管理者ユーザーを更新しました');
    } else {
      // 新しい管理者ユーザーを作成
      console.log('新しい管理者ユーザーを作成中...');
      await connection.execute(`
        INSERT INTO user_accounts (id, name, role, status, login_code, created_at, updated_at) 
        VALUES (1, 'マスターユーザ', 10, 1, 'ADMN-0001-0001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      console.log('新しい管理者ユーザーを作成しました');
    }
    
    // 管理者認証情報をチェック・作成
    console.log('管理者認証情報を確認中...');
    const [existingCreds] = await connection.execute(
      'SELECT id, username FROM admin_credentials WHERE user_id = 1'
    );
    
    if (existingCreds.length > 0) {
      console.log(`既存の認証情報が見つかりました: ID=${existingCreds[0].id}, ユーザー名=${existingCreds[0].username}`);
      
      // 既存の認証情報を更新
      await connection.execute(`
        UPDATE admin_credentials 
        SET username = 'admin001', 
            password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O',
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = 1
      `);
      console.log('既存の認証情報を更新しました');
    } else {
      // 新しい認証情報を作成
      console.log('新しい認証情報を作成中...');
      await connection.execute(`
        INSERT INTO admin_credentials (user_id, username, password_hash, created_at, updated_at) 
        VALUES (1, 'admin001', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      console.log('新しい認証情報を作成しました');
    }
    
    // 作成結果を確認
    console.log('作成結果を確認中...');
    const [finalUser] = await connection.execute(
      'SELECT id, name, role, status, login_code FROM user_accounts WHERE id = 1'
    );
    const [finalCreds] = await connection.execute(
      'SELECT user_id, username FROM admin_credentials WHERE user_id = 1'
    );
    
    console.log('=== マスターユーザ復旧完了 ===');
    console.log('ユーザー情報:');
    console.log(`  ID: ${finalUser[0].id}`);
    console.log(`  名前: ${finalUser[0].name}`);
    console.log(`  ロール: ${finalUser[0].role}`);
    console.log(`  ステータス: ${finalUser[0].status}`);
    console.log(`  ログインコード: ${finalUser[0].login_code}`);
    console.log('認証情報:');
    console.log(`  ユーザー名: ${finalCreds[0].username}`);
    console.log('パスワード: admin123');
    
    return {
      success: true,
      message: 'マスターユーザの復旧が完了しました',
      user: finalUser[0],
      credentials: finalCreds[0]
    };
    
  } catch (error) {
    console.error('マスターユーザ復旧エラー:', error);
    return {
      success: false,
      message: `エラーが発生しました: ${error.message}`,
      error: error
    };
  } finally {
    if (connection) {
      await connection.end();
      console.log('データベース接続を終了しました');
    }
  }
}

// スクリプトとして直接実行された場合
if (require.main === module) {
  restoreMasterUser()
    .then(result => {
      if (result.success) {
        console.log('✅ マスターユーザ復旧が成功しました');
        process.exit(0);
      } else {
        console.log('❌ マスターユーザ復旧が失敗しました');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ 予期しないエラーが発生しました:', error);
      process.exit(1);
    });
}

module.exports = { restoreMasterUser };
