const { pool } = require('../backend/utils/database');

async function checkStudentTables() {
  try {
    console.log('=== 学生関連テーブル構造確認 ===');
    
    // coursesテーブルの構造を確認
    console.log('\n--- coursesテーブル ---');
    const [courseColumns] = await pool.execute(`DESCRIBE courses`);
    courseColumns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // user_coursesテーブルの構造を確認
    console.log('\n--- user_coursesテーブル ---');
    const [userCourseColumns] = await pool.execute(`DESCRIBE user_courses`);
    userCourseColumns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // lessonsテーブルの構造を確認
    console.log('\n--- lessonsテーブル ---');
    const [lessonColumns] = await pool.execute(`DESCRIBE lessons`);
    lessonColumns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // user_lesson_progressテーブルの構造を確認
    console.log('\n--- user_lesson_progressテーブル ---');
    const [progressColumns] = await pool.execute(`DESCRIBE user_lesson_progress`);
    progressColumns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // user_temp_passwordsテーブルの構造を確認
    console.log('\n--- user_temp_passwordsテーブル ---');
    const [tempPasswordColumns] = await pool.execute(`DESCRIBE user_temp_passwords`);
    tempPasswordColumns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // user_accountsテーブルの構造を確認
    console.log('\n--- user_accountsテーブル ---');
    const [userColumns] = await pool.execute(`DESCRIBE user_accounts`);
    userColumns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // サンプルデータの確認
    console.log('\n=== サンプルデータ確認 ===');
    
    const [courseCount] = await pool.execute(`SELECT COUNT(*) as count FROM courses`);
    console.log(`コース数: ${courseCount[0].count}件`);
    
    const [userCourseCount] = await pool.execute(`SELECT COUNT(*) as count FROM user_courses`);
    console.log(`ユーザーコース関連付け数: ${userCourseCount[0].count}件`);
    
    const [lessonCount] = await pool.execute(`SELECT COUNT(*) as count FROM lessons`);
    console.log(`レッスン数: ${lessonCount[0].count}件`);
    
    const [userCount] = await pool.execute(`SELECT COUNT(*) as count FROM user_accounts WHERE role = 1`);
    console.log(`学生ユーザー数: ${userCount[0].count}件`);
    
    const [tempPasswordCount] = await pool.execute(`SELECT COUNT(*) as count FROM user_temp_passwords`);
    console.log(`一時パスワード数: ${tempPasswordCount[0].count}件`);
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

checkStudentTables();
