const { pool } = require('../backend/utils/database');

async function checkDailyReportsData() {
  try {
    console.log('=== 日報データ確認 ===');
    
    // 全データを確認
    console.log('1. 全日報データ:');
    const [allReports] = await pool.execute('SELECT * FROM remote_support_daily_records ORDER BY date DESC');
    console.log(`総件数: ${allReports.length}件`);
    
    if (allReports.length > 0) {
      console.log('最新の5件:');
      allReports.slice(0, 5).forEach((report, index) => {
        console.log(`${index + 1}. ID: ${report.id}, UserID: ${report.user_id}, Date: ${report.date}, WorkNote: ${report.work_note?.substring(0, 50)}...`);
      });
    }
    
    // ユーザーID=18のデータを確認
    console.log('\n2. ユーザーID=18のデータ:');
    const [user18Reports] = await pool.execute('SELECT * FROM remote_support_daily_records WHERE user_id = 18 ORDER BY date DESC');
    console.log(`ユーザーID=18の件数: ${user18Reports.length}件`);
    
    if (user18Reports.length > 0) {
      user18Reports.forEach((report, index) => {
        console.log(`${index + 1}. ID: ${report.id}, Date: ${report.date}, WorkNote: ${report.work_note?.substring(0, 50)}...`);
      });
    }
    
    // 2025-08-26のデータを確認
    console.log('\n3. 2025-08-26のデータ:');
    const [dateReports] = await pool.execute('SELECT * FROM remote_support_daily_records WHERE date = "2025-08-26" ORDER BY user_id');
    console.log(`2025-08-26の件数: ${dateReports.length}件`);
    
    if (dateReports.length > 0) {
      dateReports.forEach((report, index) => {
        console.log(`${index + 1}. ID: ${report.id}, UserID: ${report.user_id}, WorkNote: ${report.work_note?.substring(0, 50)}...`);
      });
    }
    
    // ユーザーアカウントテーブルも確認
    console.log('\n4. ユーザーアカウント確認:');
    const [users] = await pool.execute('SELECT id, name, login_code FROM user_accounts WHERE id = 18 OR login_code LIKE "%18%"');
    console.log(`該当ユーザー数: ${users.length}件`);
    
    if (users.length > 0) {
      users.forEach((user, index) => {
        console.log(`${index + 1}. ID: ${user.id}, Name: ${user.name}, LoginCode: ${user.login_code}`);
      });
    }
    
    // 最新の日報データを確認
    console.log('\n5. 最新の日報データ（全期間）:');
    const [latestReports] = await pool.execute(`
      SELECT rsdr.*, ua.name as user_name, ua.login_code
      FROM remote_support_daily_records rsdr
      LEFT JOIN user_accounts ua ON rsdr.user_id = ua.id
      ORDER BY rsdr.date DESC, rsdr.created_at DESC
      LIMIT 10
    `);
    
    console.log(`最新10件: ${latestReports.length}件`);
    if (latestReports.length > 0) {
      latestReports.forEach((report, index) => {
        console.log(`${index + 1}. ID: ${report.id}, UserID: ${report.user_id}, UserName: ${report.user_name}, Date: ${report.date}, WorkNote: ${report.work_note?.substring(0, 30)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error('スタックトレース:', error.stack);
  } finally {
    await pool.end();
  }
}

checkDailyReportsData();
