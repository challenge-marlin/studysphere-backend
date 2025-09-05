const { pool } = require('../backend/utils/database');

async function testProgressCalculation() {
  const connection = await pool.getConnection();
  
  try {
    console.log('=== 進捗計算テスト開始 ===');
    
    const userId = 98; // テスト対象ユーザー
    
    // 1. 現在のuser_coursesテーブルの状態を確認
    console.log('\n1. 現在のuser_coursesテーブルの状態:');
    const [userCourses] = await connection.execute(`
      SELECT * FROM user_courses WHERE user_id = ?
    `, [userId]);
    
    userCourses.forEach(uc => {
      console.log(`  コースID: ${uc.course_id}, 進捗率: ${uc.progress_percentage}%`);
    });
    
    // 2. 修正前の進捗計算（completedのみ）
    console.log('\n2. 修正前の進捗計算（completedのみ）:');
    const [oldProgress] = await connection.execute(`
      SELECT 
        uc.course_id,
        COUNT(l.id) as total_lessons,
        COUNT(CASE WHEN ulp.status = 'completed' THEN 1 END) as completed_lessons
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.id
      LEFT JOIN lessons l ON c.id = l.course_id AND l.status = 'active'
      LEFT JOIN user_lesson_progress ulp ON uc.user_id = ulp.user_id AND l.id = ulp.lesson_id
      WHERE uc.user_id = ? AND uc.status = 'active'
      GROUP BY uc.id, c.id
    `, [userId]);
    
    oldProgress.forEach(p => {
      const progress = p.total_lessons > 0 ? Math.round((p.completed_lessons / p.total_lessons) * 100) : 0;
      console.log(`  コースID: ${p.course_id}, 総レッスン: ${p.total_lessons}, 完了: ${p.completed_lessons}, 進捗率: ${progress}%`);
    });
    
    // 3. 修正後の進捗計算（completed + in_progress）
    console.log('\n3. 修正後の進捗計算（completed + in_progress）:');
    const [newProgress] = await connection.execute(`
      SELECT 
        uc.course_id,
        COUNT(l.id) as total_lessons,
        COUNT(CASE WHEN ulp.status = 'completed' THEN 1 END) as completed_lessons,
        COUNT(CASE WHEN ulp.status = 'in_progress' THEN 1 END) as in_progress_lessons
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.id
      LEFT JOIN lessons l ON c.id = l.course_id AND l.status = 'active'
      LEFT JOIN user_lesson_progress ulp ON uc.user_id = ulp.user_id AND l.id = ulp.lesson_id
      WHERE uc.user_id = ? AND uc.status = 'active'
      GROUP BY uc.id, c.id
    `, [userId]);
    
    newProgress.forEach(p => {
      const weightedProgress = p.completed_lessons + (p.in_progress_lessons * 0.5);
      const progress = p.total_lessons > 0 ? Math.round((weightedProgress / p.total_lessons) * 100) : 0;
      console.log(`  コースID: ${p.course_id}, 総レッスン: ${p.total_lessons}, 完了: ${p.completed_lessons}, 進行中: ${p.in_progress_lessons}, 重み付き進捗率: ${progress}%`);
    });
    
    // 4. 実際のレッスン進捗データを確認
    console.log('\n4. 実際のレッスン進捗データ:');
    const [lessonProgress] = await connection.execute(`
      SELECT 
        ulp.lesson_id,
        ulp.status,
        l.title as lesson_title,
        c.title as course_title
      FROM user_lesson_progress ulp
      JOIN lessons l ON ulp.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE ulp.user_id = ?
      ORDER BY c.id, l.order_index
    `, [userId]);
    
    lessonProgress.forEach(lp => {
      console.log(`  レッスン: ${lp.lesson_title} (${lp.course_title}), ステータス: ${lp.status}`);
    });
    
    // 5. 進捗率を手動で更新
    console.log('\n5. 進捗率を手動で更新:');
    for (const progress of newProgress) {
      const weightedProgress = progress.completed_lessons + (progress.in_progress_lessons * 0.5);
      const progressPercentage = progress.total_lessons > 0 ? Math.round((weightedProgress / progress.total_lessons) * 100) : 0;
      
      await connection.execute(`
        UPDATE user_courses 
        SET progress_percentage = ?, updated_at = NOW()
        WHERE user_id = ? AND course_id = ?
      `, [progressPercentage, userId, progress.course_id]);
      
      console.log(`  コースID ${progress.course_id}: ${progressPercentage}% に更新`);
    }
    
    // 6. 更新後の状態を確認
    console.log('\n6. 更新後のuser_coursesテーブルの状態:');
    const [updatedUserCourses] = await connection.execute(`
      SELECT * FROM user_courses WHERE user_id = ?
    `, [userId]);
    
    updatedUserCourses.forEach(uc => {
      console.log(`  コースID: ${uc.course_id}, 進捗率: ${uc.progress_percentage}%`);
    });
    
    console.log('\n=== 進捗計算テスト完了 ===');
    
  } catch (error) {
    console.error('進捗計算テストエラー:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

testProgressCalculation();
