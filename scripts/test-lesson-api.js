const { pool } = require('../backend/utils/database');

const testLessonAPI = async () => {
  const connection = await pool.getConnection();
  
  try {
    console.log('=== レッスン取得APIテスト開始 ===');
    
    // テスト用ユーザーID（原田幸輝さんのID）
    const userId = 98;
    
    // 1. コース取得APIのテスト
    console.log('\n--- コース取得APIテスト ---');
    const [courses] = await connection.execute(`
      SELECT 
        c.id,
        c.title,
        c.description,
        c.category,
        c.status,
        uc.progress_percentage,
        uc.start_date,
        uc.completion_date,
        uc.status as enrollment_status,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.status != 'deleted') as total_lessons,
        (SELECT COUNT(*) FROM user_lesson_progress ulp 
         JOIN lessons l ON ulp.lesson_id = l.id 
         WHERE l.course_id = c.id AND ulp.user_id = uc.user_id AND ulp.status = 'completed') as completed_lessons,
        cp.name as curriculum_path_name,
        cp.description as curriculum_path_description
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.id
      LEFT JOIN curriculum_paths cp ON uc.curriculum_path_id = cp.id
      WHERE uc.user_id = ? AND c.status = 'active'
      ORDER BY c.order_index ASC, c.title ASC
    `, [userId]);
    
    console.log('コース取得結果:', courses);
    
    // 2. レッスン取得APIのテスト
    console.log('\n--- レッスン取得APIテスト ---');
    const [lessons] = await connection.execute(`
      SELECT 
        l.id,
        l.title,
        l.description,
        l.duration,
        l.order_index,
        l.has_assignment,
        l.course_id,
        c.title as course_title,
        c.category as course_category,
        ulp.status as progress_status,
        ulp.completed_at,
        ulp.test_score,
        ulp.assignment_submitted,
        ulp.assignment_submitted_at,
        cp.name as curriculum_path_name,
        cp.description as curriculum_path_description
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      JOIN user_courses uc ON c.id = uc.course_id
      LEFT JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id AND ulp.user_id = uc.user_id
      LEFT JOIN curriculum_paths cp ON uc.curriculum_path_id = cp.id
      WHERE uc.user_id = ? AND l.status != 'deleted' AND c.status = 'active'
      ORDER BY l.course_id ASC, l.order_index ASC
    `, [userId]);
    
    console.log('レッスン取得結果:', lessons);
    
    // 3. 最初のレッスンの詳細確認
    if (lessons.length > 0) {
      console.log('\n--- 最初のレッスンの詳細 ---');
      const firstLesson = lessons[0];
      console.log('レッスンID:', firstLesson.id);
      console.log('レッスン名:', firstLesson.title);
      console.log('コースID:', firstLesson.course_id);
      console.log('コース名:', firstLesson.course_title);
      console.log('カリキュラムパス名:', firstLesson.curriculum_path_name);
      console.log('カリキュラムパス説明:', firstLesson.curriculum_path_description);
      console.log('課題あり:', firstLesson.has_assignment);
      console.log('課題提出済み:', firstLesson.assignment_submitted);
    }
    
    // 4. user_coursesテーブルの確認
    console.log('\n--- user_coursesテーブル確認 ---');
    const [userCourses] = await connection.execute(`
      SELECT * FROM user_courses WHERE user_id = ? AND curriculum_path_id IS NOT NULL
    `, [userId]);
    console.log('curriculum_path_idが設定されているuser_courses:', userCourses);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    connection.release();
  }
};

// スクリプト実行
testLessonAPI().then(() => {
  console.log('\nテスト完了');
  process.exit(0);
}).catch(error => {
  console.error('テスト失敗:', error);
  process.exit(1);
});
