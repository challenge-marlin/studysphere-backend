const mysql = require('mysql2/promise');

async function checkTempPasswordDB() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'studysphere',
    timezone: '+09:00'
  });

  try {
    console.log('=== データベースの一時パスワード確認 ===');
    
    // 最新の一時パスワードを取得
    const [rows] = await connection.execute(`
      SELECT 
        utp.id,
        utp.user_id,
        utp.temp_password,
        utp.expires_at,
        utp.is_used,
        utp.issued_at,
        ua.name as user_name
      FROM user_temp_passwords utp
      JOIN user_accounts ua ON utp.user_id = ua.id
      ORDER BY utp.issued_at DESC
      LIMIT 5
    `);

    console.log('最新の一時パスワード:');
    rows.forEach((row, index) => {
      console.log(`\n--- ${index + 1}番目 ---`);
      console.log('ID:', row.id);
      console.log('ユーザー名:', row.user_name);
      console.log('パスワード:', row.temp_password);
      console.log('発行日時:', row.issued_at);
      console.log('有効期限 (DB保存値):', row.expires_at);
      console.log('有効期限 (ISO文字列):', row.expires_at ? new Date(row.expires_at).toISOString() : 'null');
      console.log('有効期限 (ローカル文字列):', row.expires_at ? new Date(row.expires_at).toLocaleString() : 'null');
      console.log('使用済み:', row.is_used);
      
      // 日本時間に変換して表示
      if (row.expires_at) {
        const utcDate = new Date(row.expires_at);
        const japanOffset = 9 * 60; // 日本時間はUTC+9
        const japanDate = new Date(utcDate.getTime() + (japanOffset * 60 * 1000));
        console.log('有効期限 (日本時間):', japanDate.toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Tokyo'
        }));
      }
    });

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await connection.end();
  }
}

checkTempPasswordDB();
