const { pool } = require('../backend/utils/database');

async function checkDailyReportsDetail() {
  try {
    console.log('=== 日報データ詳細確認 ===');
    
    // テーブル構造を確認
    console.log('1. テーブル構造確認:');
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'curriculum-portal' 
      AND TABLE_NAME = 'remote_support_daily_records'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('remote_support_daily_recordsテーブルの列:');
    columns.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL可' : 'NOT NULL'}) - ${col.COLUMN_COMMENT || 'コメントなし'}`);
    });
    
    // 既存データの詳細を確認
    console.log('\n2. 既存データの詳細確認:');
    const [reports] = await pool.execute(`
      SELECT 
        rsdr.*,
        ua.name as user_name,
        ua.login_code
      FROM remote_support_daily_records rsdr
      LEFT JOIN user_accounts ua ON rsdr.user_id = ua.id
      ORDER BY rsdr.date DESC, rsdr.created_at DESC
    `);
    
    console.log(`総件数: ${reports.length}件`);
    
    if (reports.length > 0) {
      reports.forEach((report, index) => {
        console.log(`\n--- レコード ${index + 1} ---`);
        console.log(`ID: ${report.id}`);
        console.log(`ユーザーID: ${report.user_id}`);
        console.log(`ユーザー名: ${report.user_name}`);
        console.log(`ログインコード: ${report.login_code}`);
        console.log(`日付: ${report.date}`);
        console.log(`始業打刻: ${report.mark_start}`);
        console.log(`昼休憩開始: ${report.mark_lunch_start}`);
        console.log(`昼休憩終了: ${report.mark_lunch_end}`);
        console.log(`終業打刻: ${report.mark_end}`);
        console.log(`体温: ${report.temperature}`);
        console.log(`体調: ${report.condition}`);
        console.log(`体調備考: ${report.condition_note}`);
        console.log(`作業予定: ${report.work_note}`);
        console.log(`作業実績: ${report.work_result}`);
        console.log(`日報: ${report.daily_report}`);
        console.log(`支援方法: ${report.support_method}`);
        console.log(`支援方法補足: ${report.support_method_note}`);
        console.log(`作業・訓練内容: ${report.task_content}`);
        console.log(`支援内容: ${report.support_content}`);
        console.log(`助言内容: ${report.advice}`);
        console.log(`指導員コメント: ${report.instructor_comment}`);
        console.log(`記録者名: ${report.recorder_name}`);
        console.log(`Webカメラ画像: ${report.webcam_photos}`);
        console.log(`スクリーンショット: ${report.screenshots}`);
        console.log(`作成日時: ${report.created_at}`);
        console.log(`更新日時: ${report.updated_at}`);
      });
    }
    
    // ユーザーID=18のデータを特に確認
    console.log('\n3. ユーザーID=18のデータ確認:');
    const [user18Reports] = await pool.execute(`
      SELECT 
        rsdr.*,
        ua.name as user_name,
        ua.login_code
      FROM remote_support_daily_records rsdr
      LEFT JOIN user_accounts ua ON rsdr.user_id = ua.id
      WHERE rsdr.user_id = 18
      ORDER BY rsdr.date DESC
    `);
    
    console.log(`ユーザーID=18の件数: ${user18Reports.length}件`);
    
    if (user18Reports.length > 0) {
      user18Reports.forEach((report, index) => {
        console.log(`\n--- ユーザーID=18 レコード ${index + 1} ---`);
        console.log(`ID: ${report.id}`);
        console.log(`日付: ${report.date}`);
        console.log(`体温: ${report.temperature}`);
        console.log(`体調: ${report.condition}`);
        console.log(`体調備考: ${report.condition_note}`);
        console.log(`作業予定: ${report.work_note}`);
        console.log(`作業実績: ${report.work_result}`);
        console.log(`日報: ${report.daily_report}`);
        console.log(`支援方法: ${report.support_method}`);
        console.log(`作業・訓練内容: ${report.task_content}`);
        console.log(`支援内容: ${report.support_content}`);
        console.log(`助言内容: ${report.advice}`);
        console.log(`指導員コメント: ${report.instructor_comment}`);
      });
    } else {
      console.log('ユーザーID=18のデータは存在しません');
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error('スタックトレース:', error.stack);
  } finally {
    await pool.end();
  }
}

checkDailyReportsDetail();
