const mysql = require('mysql2/promise');

async function createTestData() {
  let connection;
  
  try {
    console.log('=== テストデータ作成 ===');
    
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
      SELECT id, name FROM user_accounts WHERE role = 1 LIMIT 5
    `);
    
    if (users.length === 0) {
      console.log('❌ 利用者データが見つかりません');
      return;
    }
    
    console.log(`利用者データ: ${users.length}件`);
    users.forEach(user => {
      console.log(`- ID: ${user.id}, 名前: ${user.name}`);
    });
    
    // テスト用の日報データを作成
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const testReports = [
      {
        user_id: users[0].id,
        date: today.toISOString().split('T')[0],
        mark_start: `${today.toISOString().split('T')[0]} 09:00:00`,
        mark_lunch_start: `${today.toISOString().split('T')[0]} 12:00:00`,
        mark_lunch_end: `${today.toISOString().split('T')[0]} 13:00:00`,
        mark_end: `${today.toISOString().split('T')[0]} 17:00:00`,
        temperature: '36.5',
        condition: 'good',
        condition_note: '体調は良好です。',
        work_note: 'ITリテラシー・AIの基本の学習を進めます。',
        work_result: '第1回の学習を完了しました。',
        daily_report: '今日は新しい学習内容に取り組み、理解を深めることができました。',
        support_method: '電話',
        task_content: 'オンライン学習の進め方について指導',
        support_content: '学習の進捗確認と質問対応を行いました。',
        advice: '学習意欲が高く、順調に進んでいます。',
        instructor_comment: JSON.stringify([
          {
            id: Date.now(),
            comment: '学習の進捗が良好です。次回も頑張ってください。',
            instructor_name: '佐藤指導員',
            created_at: new Date().toISOString()
          }
        ])
      },
      {
        user_id: users[0].id,
        date: yesterday.toISOString().split('T')[0],
        mark_start: `${yesterday.toISOString().split('T')[0]} 09:30:00`,
        mark_lunch_start: `${yesterday.toISOString().split('T')[0]} 12:30:00`,
        mark_lunch_end: `${yesterday.toISOString().split('T')[0]} 13:30:00`,
        mark_end: `${yesterday.toISOString().split('T')[0]} 17:30:00`,
        temperature: '36.8',
        condition: 'normal',
        condition_note: '少し疲れが見られます。',
        work_note: '前回の復習と新しい内容の学習',
        work_result: '復習を完了し、新しい内容も理解できました。',
        daily_report: '昨日の内容を復習してから新しい学習に取り組みました。',
        support_method: '電話',
        task_content: '学習内容の復習と新規内容の説明',
        support_content: '理解度の確認と質問対応を行いました。',
        advice: '疲れが見られるので、適度な休憩を取るようにしましょう。',
        instructor_comment: JSON.stringify([
          {
            id: Date.now() - 1000,
            comment: '復習がしっかりできていますね。疲れが見られるので、無理をしないようにしましょう。',
            instructor_name: '田中指導員',
            created_at: new Date(Date.now() - 86400000).toISOString()
          }
        ])
      }
    ];
    
    // 既存のテストデータを削除（同じ日付のもの）
    for (const report of testReports) {
      await connection.execute(`
        DELETE FROM remote_support_daily_records 
        WHERE user_id = ? AND date = ?
      `, [report.user_id, report.date]);
    }
    
    // テストデータを挿入
    for (const report of testReports) {
      await connection.execute(`
        INSERT INTO remote_support_daily_records (
          user_id, date, mark_start, mark_lunch_start, mark_lunch_end, mark_end,
          temperature, condition, condition_note, work_note, work_result,
          daily_report, support_method, task_content, support_content, advice,
          instructor_comment, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        report.user_id, report.date, report.mark_start, report.mark_lunch_start,
        report.mark_lunch_end, report.mark_end, report.temperature, report.condition,
        report.condition_note, report.work_note, report.work_result, report.daily_report,
        report.support_method, report.task_content, report.support_content, report.advice,
        report.instructor_comment
      ]);
    }
    
    console.log(`✅ テストデータを作成しました: ${testReports.length}件`);
    
    // 作成したデータを確認
    const [createdData] = await connection.execute(`
      SELECT COUNT(*) as count FROM remote_support_daily_records
    `);
    console.log(`総日報データ件数: ${createdData[0].count}件`);
    
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
