const mysql = require('mysql2/promise');

async function checkGSueyoshiUser() {
  let connection;
  try {
    console.log('=== g.sueyoshi ユーザー状態確認 ===');
    
    // データベース接続
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'shinomoto926!',
      database: 'curriculum-portal'
    });
    
    console.log('データベース接続成功');
    
    // admin_credentialsテーブルから検索
    console.log('\n--- admin_credentials テーブル検索 ---');
    const [adminRows] = await connection.execute(
      'SELECT * FROM admin_credentials WHERE username = ?',
      ['g.sueyoshi']
    );
    
    console.log('検索結果:', adminRows.length, '件');
    if (adminRows.length > 0) {
      console.log('admin_credentials データ:', adminRows[0]);
      
      // 対応するuser_accountsの情報も取得
      const [userRows] = await connection.execute(
        `SELECT ua.*, c.name as company_name 
         FROM user_accounts ua 
         LEFT JOIN companies c ON ua.company_id = c.id
         WHERE ua.id = ?`,
        [adminRows[0].user_id]
      );
      
      console.log('\n--- 対応するuser_accounts情報 ---');
      if (userRows.length > 0) {
        console.log('user_accounts データ:', userRows[0]);
        
        // ログイン条件の確認
        console.log('\n--- ログイン条件チェック ---');
        console.log('status = 1:', userRows[0].status === 1);
        console.log('role >= 4:', userRows[0].role >= 4);
        console.log('username存在:', adminRows[0].username ? 'Yes' : 'No');
        console.log('password_hash存在:', adminRows[0].password_hash ? 'Yes' : 'No');
        
        if (userRows[0].status !== 1) {
          console.log('❌ 問題: ユーザーのステータスが無効 (status =', userRows[0].status, ')');
        }
        if (userRows[0].role < 4) {
          console.log('❌ 問題: ユーザーのロールが不足 (role =', userRows[0].role, ')');
        }
        if (!adminRows[0].username) {
          console.log('❌ 問題: ユーザー名が設定されていない');
        }
        if (!adminRows[0].password_hash) {
          console.log('❌ 問題: パスワードハッシュが設定されていない');
        }
        
        if (userRows[0].status === 1 && userRows[0].role >= 4 && adminRows[0].username && adminRows[0].password_hash) {
          console.log('✅ ログイン条件は満たされています');
        }
      } else {
        console.log('❌ 問題: 対応するuser_accountsが見つかりません');
      }
    } else {
      console.log('❌ 問題: admin_credentialsにg.sueyoshiが見つかりません');
      
      // 似たようなユーザー名を検索
      console.log('\n--- 類似ユーザー名検索 ---');
      const [similarRows] = await connection.execute(
        "SELECT username FROM admin_credentials WHERE username LIKE '%sueyoshi%' OR username LIKE '%g%'"
      );
      console.log('類似ユーザー名:', similarRows);
    }
    
  } catch (error) {
    console.error('エラー:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nデータベース接続終了');
    }
  }
}

checkGSueyoshiUser();
