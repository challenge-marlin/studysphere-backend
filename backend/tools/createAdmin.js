const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// データベース設定
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'shinomoto926!',
  database: 'curriculum-portal',
  port: 3307, // Docker Composeでポート3307にマッピングされている
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

/**
 * 管理者アカウントを作成する関数
 */
const createAdminAccount = async () => {
  let connection;
  
  try {
    console.log('データベースに接続中...');
    connection = await mysql.createConnection(dbConfig);
    
    // アドミニストレータ企業を作成
    console.log('アドミニストレータ企業を作成中...');
    await connection.execute(`
      INSERT IGNORE INTO companies (id, name) 
      VALUES (1, 'アドミニストレータ')
    `);
    
    // 管理者ユーザーアカウントを作成
    console.log('管理者ユーザーアカウントを作成中...');
    await connection.execute(`
      INSERT IGNORE INTO user_accounts (id, name, role, status, login_code, company_id, satellite_ids) 
      VALUES (1, 'アドミン', 9, 1, 'ADMN-0001-0001', 1, NULL)
    `);
    
    // パスワードハッシュを生成
    const password = 'admin123';
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // 管理者認証情報を作成
    console.log('管理者認証情報を作成中...');
    await connection.execute(`
      INSERT IGNORE INTO admin_credentials (user_id, username, password_hash) 
      VALUES (1, 'admin001', ?)
    `, [passwordHash]);
    
    // 作成されたアカウントを確認
    console.log('作成されたアカウントを確認中...');
    const [rows] = await connection.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.role,
        ua.status,
        ua.login_code,
        ac.username,
        ac.created_at
      FROM user_accounts ua
      LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
      WHERE ua.role = 9
    `);
    
    console.log('=== 管理者アカウント情報 ===');
    console.log(JSON.stringify(rows, null, 2));
    
    // パスワード検証テスト
    const testPassword = 'admin123';
    const isValid = await bcrypt.compare(testPassword, passwordHash);
    console.log(`\nパスワード検証テスト: ${isValid ? '成功' : '失敗'}`);
    
    console.log('\n=== ログイン情報 ===');
    console.log('ユーザーID: admin001');
    console.log('パスワード: admin123');
    
    console.log('\n管理者アカウントの作成が完了しました！');
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// スクリプト実行
createAdminAccount(); 