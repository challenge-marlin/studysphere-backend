const { pool } = require('./backend/utils/database');

async function insertTestData() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Inserting test data for user 98...');
    
    // テスト用の終了証データを挿入
    const insertQuery = `
      INSERT INTO exam_results (
        user_id, lesson_id, test_type, section_index, lesson_name, s3_key,
        passed, score, total_questions, percentage, exam_date
      ) VALUES (
        98, 1, 'lesson', NULL, 'テストレッスン1', 'test/s3/key/1',
        true, 85, 100, 85.00, NOW()
      ), (
        98, 2, 'lesson', NULL, 'テストレッスン2', 'test/s3/key/2',
        true, 90, 100, 90.00, NOW()
      )
    `;
    
    const [result] = await connection.execute(insertQuery);
    console.log('Test data inserted successfully:', result);
    
    // 挿入されたデータを確認
    const [checkData] = await connection.execute(
      'SELECT * FROM exam_results WHERE user_id = 98'
    );
    console.log('Inserted data:', checkData);
    
  } catch (error) {
    console.error('Error inserting test data:', error.message);
  } finally {
    connection.release();
  }
}

insertTestData();
