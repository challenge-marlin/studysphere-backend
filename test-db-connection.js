const { pool } = require('./backend/utils/database');

async function testDatabaseConnection() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Testing database connection...');
    
    // テーブル一覧を確認
    const [tables] = await connection.execute("SHOW TABLES LIKE 'exam_results'");
    console.log('exam_results table exists:', tables.length > 0);
    
    if (tables.length > 0) {
      // テーブル構造を確認
      const [structure] = await connection.execute("DESCRIBE exam_results");
      console.log('exam_results table structure:');
      structure.forEach(col => {
        console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      
      // データ件数を確認
      const [count] = await connection.execute("SELECT COUNT(*) as count FROM exam_results");
      console.log('Total exam_results records:', count[0].count);
      
      // ユーザーID 98のデータを確認
      const [userData] = await connection.execute("SELECT COUNT(*) as count FROM exam_results WHERE user_id = 98");
      console.log('Records for user 98:', userData[0].count);
      
      // 合格データを確認
      const [passedData] = await connection.execute("SELECT COUNT(*) as count FROM exam_results WHERE user_id = 98 AND passed = true");
      console.log('Passed records for user 98:', passedData[0].count);
      
      // 実際のデータを確認（最初の5件）
      const [sampleData] = await connection.execute("SELECT * FROM exam_results WHERE user_id = 98 LIMIT 5");
      console.log('Sample data for user 98:');
      sampleData.forEach((row, index) => {
        console.log(`  Record ${index + 1}:`, {
          id: row.id,
          lesson_id: row.lesson_id,
          passed: row.passed,
          score: row.score,
          exam_date: row.exam_date
        });
      });
    }
    
  } catch (error) {
    console.error('Database test error:', error.message);
  } finally {
    connection.release();
  }
}

testDatabaseConnection();
