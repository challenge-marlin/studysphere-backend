const { pool } = require('../backend/utils/database');

async function fixTestTypes() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Fixing test_type for 30-question tests...');
    
    // 30問のテストをlessonタイプに修正
    const [result] = await connection.execute(
      "UPDATE exam_results SET test_type = 'lesson' WHERE total_questions = 30 AND user_id = 98"
    );
    
    console.log('Updated records:', result.affectedRows);
    
    // 修正後のデータを確認
    const [checkData] = await connection.execute(
      "SELECT id, test_type, total_questions, passed, score, percentage FROM exam_results WHERE user_id = 98 ORDER BY id"
    );
    
    console.log('Updated data:');
    checkData.forEach(row => {
      console.log(`ID: ${row.id}, Type: ${row.test_type}, Questions: ${row.total_questions}, Passed: ${row.passed}, Score: ${row.score}/${row.total_questions} (${row.percentage}%)`);
    });
    
  } catch (error) {
    console.error('Error fixing test types:', error.message);
  } finally {
    connection.release();
  }
}

fixTestTypes();
