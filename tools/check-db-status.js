const { pool } = require('./backend/utils/database');

async function checkDatabaseStatus() {
  const connection = await pool.getConnection();
  
  try {
    console.log('=== データベース状態確認 ===');
    
    // 1. ユーザーアカウントの確認
    console.log('\n1. ユーザーアカウント:');
    const [users] = await connection.execute('SELECT id, username, role FROM user_accounts LIMIT 5');
    console.log('ユーザー数:', users.length);
    users.forEach(user => console.log(`  ID: ${user.id}, ユーザー名: ${user.username}, 役割: ${user.role}`));
    
    // 2. コースの確認
    console.log('\n2. コース:');
    const [courses] = await connection.execute('SELECT id, title, status FROM courses LIMIT 5');
    console.log('コース数:', courses.length);
    courses.forEach(course => console.log(`  ID: ${course.id}, タイトル: ${course.title}, ステータス: ${course.status}`));
    
    // 3. レッスンの確認
    console.log('\n3. レッスン:');
    const [lessons] = await connection.execute('SELECT id, title, course_id, status FROM lessons LIMIT 10');
    console.log('レッスン数:', lessons.length);
    lessons.forEach(lesson => console.log(`  ID: ${lesson.id}, タイトル: ${lesson.title}, コースID: ${lesson.course_id}, ステータス: ${lesson.status}`));
    
    // 4. ユーザーコース関連付けの確認
    console.log('\n4. ユーザーコース関連付け:');
    const [userCourses] = await connection.execute('SELECT user_id, course_id, status, progress_percentage FROM user_courses LIMIT 10');
    console.log('ユーザーコース関連付け数:', userCourses.length);
    userCourses.forEach(uc => console.log(`  ユーザーID: ${uc.user_id}, コースID: ${uc.course_id}, ステータス: ${uc.status}, 進捗: ${uc.progress_percentage}%`));
    
    // 5. レッスン進捗の確認
    console.log('\n5. レッスン進捗:');
    const [lessonProgress] = await connection.execute('SELECT user_id, lesson_id, status, created_at FROM user_lesson_progress LIMIT 10');
    console.log('レッスン進捗数:', lessonProgress.length);
    lessonProgress.forEach(lp => console.log(`  ユーザーID: ${lp.user_id}, レッスンID: ${lp.lesson_id}, ステータス: ${lp.status}, 作成日時: ${lp.created_at}`));
    
    // 6. 特定のユーザーの進捗状況
    if (users.length > 0) {
      const testUserId = users[0].id;
      console.log(`\n6. ユーザーID ${testUserId} の詳細進捗:`);
      
      const [userProgress] = await connection.execute(`
        SELECT 
          uc.user_id,
          uc.course_id,
          c.title as course_title,
          uc.progress_percentage,
          COUNT(l.id) as total_lessons,
          COUNT(ulp.id) as progress_records
        FROM user_courses uc
        JOIN courses c ON uc.course_id = c.id
        LEFT JOIN lessons l ON c.id = l.course_id AND l.status = 'active'
        LEFT JOIN user_lesson_progress ulp ON uc.user_id = ulp.user_id AND l.id = ulp.lesson_id
        WHERE uc.user_id = ?
        GROUP BY uc.id, c.id
      `, [testUserId]);
      
      userProgress.forEach(up => console.log(`  コース: ${up.course_title}, 進捗: ${up.progress_percentage}%, 総レッスン: ${up.total_lessons}, 進捗レコード: ${up.progress_records}`));
    }
    
  } catch (error) {
    console.error('データベース確認エラー:', error);
  } finally {
    connection.release();
    console.log('\n=== 確認完了 ===');
    process.exit(0);
  }
}

checkDatabaseStatus();
