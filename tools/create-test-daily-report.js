const { pool } = require('../backend/utils/database');

async function createTestDailyReport() {
  try {
    console.log('=== テスト日報データ作成 ===');
    
    const userId = 18;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
    const now = new Date().toISOString().slice(0, 19).replace('T', ' '); // YYYY-MM-DD HH:MM:SS形式
    
    console.log('作成するデータ:');
    console.log(`- ユーザーID: ${userId}`);
    console.log(`- 日付: ${today}`);
    console.log(`- 現在時刻: ${now}`);
    
    // 既存データを確認
    const [existingRecords] = await pool.execute(
      'SELECT id FROM remote_support_daily_records WHERE user_id = ? AND date = ?',
      [userId, today]
    );
    
    if (existingRecords.length > 0) {
      console.log(`既存のレコードが存在します: ID ${existingRecords[0].id}`);
      console.log('既存データを更新します...');
      
      // 既存レコードを更新
      await pool.execute(`
        UPDATE remote_support_daily_records SET 
          mark_start = ?,
          mark_end = ?,
          temperature = ?,
          \`condition\` = ?,
          condition_note = ?,
          work_note = ?,
          work_result = ?,
          daily_report = ?,
          support_method = ?,
          task_content = ?,
          support_content = ?,
          advice = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [
        now, // mark_start
        now, // mark_end
        '36.8', // temperature
        'good', // condition
        '体調良好です', // condition_note
        'Excelの基本操作とデータ分析の学習を進めます。', // work_note
        'Excelの基本操作を習得し、簡単なデータ分析ができるようになりました。', // work_result
        '今日はExcelの学習に集中し、新しいスキルを身につけることができました。', // daily_report
        null, // support_method
        'Excelの基本操作、データ入力、簡単な計算式の作成', // task_content
        '操作方法の説明、質問への回答、進捗確認', // support_content
        '着実にスキルアップしています。次回はより高度な機能に挑戦しましょう。', // advice
        existingRecords[0].id
      ]);
      
      console.log('✅ 既存データを更新しました');
    } else {
      console.log('新規データを作成します...');
      
      // 新規レコードを作成
      const [result] = await pool.execute(`
        INSERT INTO remote_support_daily_records (
          user_id, date, mark_start, mark_end, temperature, \`condition\`, 
          condition_note, work_note, work_result, daily_report, support_method,
          task_content, support_content, advice, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        userId, // user_id
        today, // date
        now, // mark_start
        now, // mark_end
        '36.8', // temperature
        'good', // condition
        '体調良好です', // condition_note
        'Excelの基本操作とデータ分析の学習を進めます。', // work_note
        'Excelの基本操作を習得し、簡単なデータ分析ができるようになりました。', // work_result
        '今日はExcelの学習に集中し、新しいスキルを身につけることができました。', // daily_report
        '電話', // support_method
        'Excelの基本操作、データ入力、簡単な計算式の作成', // task_content
        '操作方法の説明、質問への回答、進捗確認', // support_content
        '着実にスキルアップしています。次回はより高度な機能に挑戦しましょう。' // advice
      ]);
      
      console.log(`✅ 新規データを作成しました: ID ${result.insertId}`);
    }
    
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
      console.log(`体調備考: ${report.condition_note}`);
      console.log(`作業予定: ${report.work_note}`);
      console.log(`作業実績: ${report.work_result}`);
      console.log(`日報: ${report.daily_report}`);
      console.log(`支援方法: ${report.support_method}`);
      console.log(`作業・訓練内容: ${report.task_content}`);
      console.log(`支援内容: ${report.support_content}`);
      console.log(`助言内容: ${report.advice}`);
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error('スタックトレース:', error.stack);
  } finally {
    await pool.end();
  }
}

createTestDailyReport();
