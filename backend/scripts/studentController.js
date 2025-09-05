const { customLogger } = require('../utils/logger');
const { pool } = require('../utils/database');

/**
 * 利用者のコース一覧を取得
 */
const getStudentCourses = async (req, res) => {
  console.log('=== getStudentCourses 関数が実行されました ===');
  console.log('ファイルパス:', __filename);
  console.log('現在時刻:', new Date().toISOString());
  
  const userId = req.user.user_id;
  const connection = await pool.getConnection();
  
  try {
    // 利用者が受講しているコース一覧を取得
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

    customLogger.info('Student courses retrieved successfully', {
      userId,
      count: courses.length
    });

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    customLogger.error('Failed to retrieve student courses', {
      error: error.message,
      userId
    });
    
    res.status(500).json({
      success: false,
      message: 'コース一覧の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 利用者のレッスン一覧を取得
 */
const getStudentLessons = async (req, res) => {
  const userId = req.user.user_id;
  const { courseId } = req.query;
  const connection = await pool.getConnection();
  
  try {
    let query = `
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
    `;
    
    const params = [userId];
    
    if (courseId) {
      query += ' AND l.course_id = ?';
      params.push(courseId);
    }
    
    query += ' ORDER BY l.course_id ASC, l.order_index ASC';
    
    const [lessons] = await connection.execute(query, params);

    customLogger.info('Student lessons retrieved successfully', {
      userId,
      courseId,
      count: lessons.length
    });

    res.json({
      success: true,
      data: lessons
    });
  } catch (error) {
    customLogger.error('Failed to retrieve student lessons', {
      error: error.message,
      userId,
      courseId: req.query.courseId
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスン一覧の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 利用者のレッスン進捗を取得
 */
const getStudentLessonProgress = async (req, res) => {
  const userId = req.user.user_id;
  const { lessonId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    const [progress] = await connection.execute(`
      SELECT 
        ulp.*,
        l.title as lesson_title,
        c.title as course_title
      FROM user_lesson_progress ulp
      JOIN lessons l ON ulp.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE ulp.user_id = ? AND ulp.lesson_id = ?
    `, [userId, lessonId]);

    if (progress.length === 0) {
      // 進捗レコードが存在しない場合は新規作成
      const [lesson] = await connection.execute(`
        SELECT id, title, course_id FROM lessons WHERE id = ?
      `, [lessonId]);
      
      if (lesson.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'レッスンが見つかりません'
        });
      }
      
      // 新規進捗レコードを作成
      await connection.execute(`
        INSERT INTO user_lesson_progress (user_id, lesson_id, status, created_at, updated_at)
        VALUES (?, ?, 'not_started', NOW(), NOW())
      `, [userId, lessonId]);
      
      const newProgress = {
        user_id: userId,
        lesson_id: lessonId,
        status: 'not_started',
        completed_at: null,
        test_score: null,
        assignment_submitted: false,
        assignment_submitted_at: null,
        lesson_title: lesson[0].title,
        course_title: ''
      };
      
      return res.json({
        success: true,
        data: newProgress
      });
    }

    customLogger.info('Student lesson progress retrieved successfully', {
      userId,
      lessonId
    });

    res.json({
      success: true,
      data: progress[0]
    });
  } catch (error) {
    customLogger.error('Failed to retrieve student lesson progress', {
      error: error.message,
      userId,
      lessonId
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスン進捗の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 利用者のレッスン進捗を更新
 */
const updateStudentLessonProgress = async (req, res) => {
  const userId = req.user.user_id;
  const { lessonId } = req.params;
  const { status, test_score, assignment_submitted } = req.body;
  const connection = await pool.getConnection();
  
  try {
    // 進捗レコードの存在確認
    const [existing] = await connection.execute(`
      SELECT id FROM user_lesson_progress 
      WHERE user_id = ? AND lesson_id = ?
    `, [userId, lessonId]);

    let completedAt = null;
    if (status === 'completed') {
      completedAt = new Date();
    }

    if (existing.length === 0) {
      // 新規作成
      await connection.execute(`
        INSERT INTO user_lesson_progress 
        (user_id, lesson_id, status, completed_at, test_score, assignment_submitted, assignment_submitted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [userId, lessonId, status, completedAt, test_score, assignment_submitted, assignment_submitted ? new Date() : null]);
    } else {
      // 更新
      await connection.execute(`
        UPDATE user_lesson_progress 
        SET status = ?, completed_at = ?, test_score = ?, assignment_submitted = ?, 
            assignment_submitted_at = ?, updated_at = NOW()
        WHERE user_id = ? AND lesson_id = ?
      `, [status, completedAt, test_score, assignment_submitted, assignment_submitted ? new Date() : null, userId, lessonId]);
    }

    customLogger.info('Student lesson progress updated successfully', {
      userId,
      lessonId,
      status,
      test_score,
      assignment_submitted
    });

    res.json({
      success: true,
      message: 'レッスン進捗を更新しました'
    });
  } catch (error) {
    customLogger.error('Failed to update student lesson progress', {
      error: error.message,
      userId,
      lessonId
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスン進捗の更新に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 利用者のダッシュボード情報を取得
 */
const getStudentDashboard = async (req, res) => {
  const userId = req.user.user_id;
  const connection = await pool.getConnection();
  
  try {
    // 総合統計情報を取得
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT c.id) as total_courses,
        COUNT(DISTINCT l.id) as total_lessons,
        COUNT(CASE WHEN ulp.status = 'completed' THEN 1 END) as completed_lessons,
        COUNT(CASE WHEN ulp.status = 'in_progress' THEN 1 END) as in_progress_lessons,
        COUNT(CASE WHEN ulp.status = 'not_started' THEN 1 END) as not_started_lessons,
        AVG(ulp.test_score) as average_test_score
      FROM user_courses uc
      JOIN courses c ON uc.course_id = c.id
      LEFT JOIN lessons l ON c.id = l.course_id
      LEFT JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id AND ulp.user_id = uc.user_id
      WHERE uc.user_id = ? AND c.status = 'active' AND l.status != 'deleted'
    `, [userId]);

    // 最近の進捗を取得
    const [recentProgress] = await connection.execute(`
      SELECT 
        ulp.*,
        l.title as lesson_title,
        c.title as course_title
      FROM user_lesson_progress ulp
      JOIN lessons l ON ulp.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE ulp.user_id = ? AND ulp.updated_at IS NOT NULL
      ORDER BY ulp.updated_at DESC
      LIMIT 5
    `, [userId]);

    // 最後に学習したレッスンの詳細情報を取得
    const [lastLessonData] = await connection.execute(`
      SELECT 
        ulp.lesson_id,
        ulp.completed_at,
        ulp.test_score,
        ulp.status,
        l.title as lesson_title,
        l.order_index as lesson_order,
        c.title as course_title,
        c.id as course_id,
        c.category as course_category
      FROM user_lesson_progress ulp
      JOIN lessons l ON ulp.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE ulp.user_id = ? AND ulp.status = 'completed'
      ORDER BY ulp.completed_at DESC
      LIMIT 1
    `, [userId]);

    const dashboardData = {
      stats: stats[0] || {
        total_courses: 0,
        total_lessons: 0,
        completed_lessons: 0,
        in_progress_lessons: 0,
        not_started_lessons: 0,
        average_test_score: 0
      },
      recent_progress: recentProgress,
      last_lesson: lastLessonData[0] || null
    };

    customLogger.info('Student dashboard data retrieved successfully', {
      userId
    });

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    customLogger.error('Failed to retrieve student dashboard data', {
      error: error.message,
      userId
    });
    
    res.status(500).json({
      success: false,
      message: 'ダッシュボード情報の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getStudentCourses,
  getStudentLessons,
  getStudentLessonProgress,
  updateStudentLessonProgress,
  getStudentDashboard
};
