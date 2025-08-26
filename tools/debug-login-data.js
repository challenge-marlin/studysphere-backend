const { pool } = require('../backend/utils/database');

async function debugLoginData() {
  try {
    console.log('=== ログインデータデバッグ ===');
    
    const userId = 18;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
    
    console.log(`ユーザーID: ${userId}`);
    console.log(`日付: ${today}`);
    
    // 今日のデータを確認
    console.log('\n1. 今日のデータ確認:');
    const [todayData] = await pool.execute(`
      SELECT 
        rsdr.*,
        ua.name as user_name,
        ua.login_code
      FROM remote_support_daily_records rsdr
      LEFT JOIN user_accounts ua ON rsdr.user_id = ua.id
      WHERE rsdr.user_id = ? AND rsdr.date = ?
      ORDER BY rsdr.created_at DESC
    `, [userId, today]);
    
    console.log(`今日のデータ件数: ${todayData.length}件`);
    
    if (todayData.length > 0) {
      todayData.forEach((record, index) => {
        console.log(`\n--- レコード ${index + 1} ---`);
        console.log(`ID: ${record.id}`);
        console.log(`作成日時: ${record.created_at}`);
        console.log(`更新日時: ${record.updated_at}`);
        console.log(`体温: ${record.temperature}`);
        console.log(`体調: ${record.condition}`);
        console.log(`体調備考: ${record.condition_note}`);
        console.log(`作業予定: ${record.work_note}`);
        console.log(`始業打刻: ${record.mark_start}`);
        console.log(`終業打刻: ${record.mark_end}`);
      });
    } else {
      console.log('今日のデータは存在しません');
    }
    
    // 全期間のデータを確認
    console.log('\n2. 全期間のデータ確認:');
    const [allData] = await pool.execute(`
      SELECT 
        rsdr.*,
        ua.name as user_name,
        ua.login_code
      FROM remote_support_daily_records rsdr
      LEFT JOIN user_accounts ua ON rsdr.user_id = ua.id
      WHERE rsdr.user_id = ?
      ORDER BY rsdr.date DESC, rsdr.created_at DESC
    `, [userId]);
    
    console.log(`全期間のデータ件数: ${allData.length}件`);
    
    if (allData.length > 0) {
      allData.forEach((record, index) => {
        console.log(`\n--- 全期間レコード ${index + 1} ---`);
        console.log(`ID: ${record.id}`);
        console.log(`日付: ${record.date}`);
        console.log(`作成日時: ${record.created_at}`);
        console.log(`体温: ${record.temperature}`);
        console.log(`体調: ${record.condition}`);
        console.log(`作業予定: ${record.work_note}`);
      });
    }
    
    // 最新のログイン試行を確認
    console.log('\n3. 最新のログイン試行確認:');
    const [latestLogin] = await pool.execute(`
      SELECT 
        rsdr.*,
        ua.name as user_name,
        ua.login_code
      FROM remote_support_daily_records rsdr
      LEFT JOIN user_accounts ua ON rsdr.user_id = ua.id
      WHERE rsdr.user_id = ?
      ORDER BY rsdr.created_at DESC
      LIMIT 1
    `, [userId]);
    
    if (latestLogin.length > 0) {
      const record = latestLogin[0];
      console.log('最新のログイン記録:');
      console.log(`ID: ${record.id}`);
      console.log(`日付: ${record.date}`);
      console.log(`作成日時: ${record.created_at}`);
      console.log(`体温: ${record.temperature}`);
      console.log(`体調: ${record.condition}`);
      console.log(`体調備考: ${record.condition_note}`);
      console.log(`作業予定: ${record.work_note}`);
      console.log(`始業打刻: ${record.mark_start}`);
    } else {
      console.log('ログイン記録が存在しません');
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error('スタックトレース:', error.stack);
  } finally {
    await pool.end();
  }
}

debugLoginData();
