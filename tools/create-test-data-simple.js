const mysql = require('mysql2/promise');

async function createTestData() {
  let connection;
  
  try {
    console.log('=== シンプルテストデータ作成 ===');
    
    // データベース設定
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'shinomoto926!',
      database: process.env.DB_NAME || 'curriculum-portal',
      port: process.env.DB_PORT || 3307,
    };
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ データベース接続成功');
    
    // 利用者データを取得
    const [users] = await connection.execute(`
      SELECT id, name FROM user_accounts WHERE role = 1 LIMIT 1
    `);
    
    if (users.length === 0) {
      console.log('❌ 利用者データが見つかりません');
      return;
    }
    
    console.log(`利用者: ID ${users[0].id}, 名前: ${users[0].name}`);
    
    // 今日の日付
    const today = new Date().toISOString().split('T')[0];
    
    // 既存のテストデータを削除
    await connection.execute(`
      DELETE FROM remote_support_daily_records 
      WHERE user_id = ? AND date = ?
    `, [users[0].id, today]);
    
    // シンプルなテストデータを挿入
    const insertQuery = `
      INSERT INTO remote_support_daily_records (
        user_id, date, mark_start, mark_end,
        temperature, \`condition\`, work_note, daily_report,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    const values = [
      users[0].id,
      today,
      `${today} 09:00:00`,
      `${today} 17:00:00`,
      '36.5',
      'good',
      'ITリテラシー・AIの基本の学習を進めます。',
      '今日は新しい学習内容に取り組み、理解を深めることができました。'
    ];
    
    console.log('挿入クエリ:', insertQuery);
    console.log('値:', values);
    
    await connection.execute(insertQuery, values);
    
    console.log('✅ テストデータを作成しました');
    
    // 作成したデータを確認
    const [createdData] = await connection.execute(`
      SELECT COUNT(*) as count FROM remote_support_daily_records
    `);
    console.log(`総日報データ件数: ${createdData[0].count}件`);
    
    // 作成したデータの詳細を確認
    const [reportData] = await connection.execute(`
      SELECT * FROM remote_support_daily_records WHERE user_id = ? AND date = ?
    `, [users[0].id, today]);
    
    if (reportData.length > 0) {
      console.log('作成されたデータ:');
      console.log(JSON.stringify(reportData[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error('エラー詳細:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nデータベース接続を閉じました');
    }
  }
}

createTestData();
