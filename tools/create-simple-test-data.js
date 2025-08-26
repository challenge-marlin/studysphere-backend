const { pool } = require('../backend/utils/database');

async function createSimpleTestData() {
  try {
    console.log('=== シンプルテストデータ作成 ===');
    
    const userId = 18;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
    const now = new Date().toISOString().slice(0, 19).replace('T', ' '); // YYYY-MM-DD HH:MM:SS形式
    
    console.log('作成するデータ:');
    console.log(`- ユーザーID: ${userId}`);
    console.log(`- 日付: ${today}`);
    console.log(`- 現在時刻: ${now}`);
    
    // 最小限のデータで新規レコードを作成
    const [result] = await pool.execute(`
      INSERT INTO remote_support_daily_records (
        user_id, date, mark_start, temperature, \`condition\`, 
        work_note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      userId, // user_id
      today, // date
      now, // mark_start
      '36.8', // temperature
      'good', // condition
      'テスト用の作業内容です。' // work_note
    ]);
    
    console.log(`✅ シンプルなテストデータを作成しました: ID ${result.insertId}`);
    
    // 作成したデータを確認
    console.log('\n作成したデータを確認:');
    const [createdData] = await pool.execute(`
      SELECT 
        rsdr.*,
        ua.name as user_name,
        ua.login_code
      FROM remote_support_daily_records rsdr
      LEFT JOIN user_accounts ua ON rsdr.user_id = ua.id
      WHERE rsdr.user_id = ? AND rsdr.date = ?
    `, [userId, today]);
    
    if (createdData.length > 0) {
      const report = createdData[0];
      console.log(`ID: ${report.id}`);
      console.log(`ユーザー名: ${report.user_name}`);
      console.log(`ログインコード: ${report.login_code}`);
      console.log(`日付: ${report.date}`);
      console.log(`体温: ${report.temperature}`);
      console.log(`体調: ${report.condition}`);
      console.log(`作業予定: ${report.work_note}`);
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error('スタックトレース:', error.stack);
  } finally {
    await pool.end();
  }
}

createSimpleTestData();
