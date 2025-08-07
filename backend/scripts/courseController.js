const { customLogger } = require('../utils/logger');
const { pool } = require('../utils/database');
const { recordOperationLog } = require('./operationLogController');

// コース一覧取得
const getCourses = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT 
        c.*,
        COUNT(CASE WHEN l.status != 'deleted' THEN 1 END) as lesson_count,
        COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_lessons
      FROM courses c
      LEFT JOIN lessons l ON c.id = l.course_id
      WHERE c.status != 'deleted'
      GROUP BY c.id
      ORDER BY c.order_index ASC, c.created_at DESC
    `);

    customLogger.info('Courses retrieved successfully', {
      count: rows.length,
      userId: req.user?.id
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Failed to retrieve courses', {
      error: error.message,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'コースの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// コース詳細取得
const getCourseById = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // コース情報取得
    const [courseRows] = await connection.execute(`
      SELECT * FROM courses WHERE id = ? AND status != 'deleted'
    `, [id]);

    if (courseRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'コースが見つかりません'
      });
    }

    // レッスン情報取得
    const [lessonRows] = await connection.execute(`
      SELECT * FROM lessons 
      WHERE course_id = ? AND status != 'deleted'
      ORDER BY order_index ASC
    `, [id]);

    const course = courseRows[0];
    course.lessons = lessonRows;

    customLogger.info('Course retrieved successfully', {
      courseId: id,
      lessonCount: lessonRows.length,
      userId: req.user?.id
    });

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    customLogger.error('Failed to retrieve course', {
      error: error.message,
      courseId: id,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'コースの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// コース作成
const createCourse = async (req, res) => {
  const { title, description, category, order_index } = req.body;
  const connection = await pool.getConnection();
  
  try {
    const [result] = await connection.execute(`
      INSERT INTO courses (title, description, category, order_index, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [title, description, category, order_index || 0, req.user?.id || 1]);

    const courseId = result.insertId;

    // 操作ログ記録（認証なしの場合はスキップ）
    if (req.user?.id) {
      await recordOperationLog({
        userId: req.user.id,
        action: 'create_course',
        targetType: 'course',
        targetId: courseId,
        details: { title, category }
      });
    }

    customLogger.info('Course created successfully', {
      courseId: courseId,
      title: title,
      userId: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: 'コースが正常に作成されました',
      data: { id: courseId, title, description, category }
    });
  } catch (error) {
    customLogger.error('Failed to create course', {
      error: error.message,
      title: title,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'コースの作成に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// コース更新
const updateCourse = async (req, res) => {
  const { id } = req.params;
  const { title, description, category, order_index, status } = req.body;
  const connection = await pool.getConnection();
  
  try {
    // コース存在確認
    const [existingRows] = await connection.execute(`
      SELECT * FROM courses WHERE id = ? AND status != 'deleted'
    `, [id]);

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'コースが見つかりません'
      });
    }

    const [result] = await connection.execute(`
      UPDATE courses 
      SET title = ?, description = ?, category = ?, order_index = ?, status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title, description, category, order_index, status, req.user?.id, id]);

    // 操作ログ記録
    await recordOperationLog({
      userId: req.user?.id,
      action: 'update_course',
      targetType: 'course',
      targetId: id,
      details: { title, category, status }
    });

    customLogger.info('Course updated successfully', {
      courseId: id,
      title: title,
      userId: req.user?.id
    });

    res.json({
      success: true,
      message: 'コースが正常に更新されました',
      data: { id, title, description, category, status }
    });
  } catch (error) {
    customLogger.error('Failed to update course', {
      error: error.message,
      courseId: id,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'コースの更新に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// コース削除（論理削除）
const deleteCourse = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // コース存在確認
    const [existingRows] = await connection.execute(`
      SELECT * FROM courses WHERE id = ? AND status != 'deleted'
    `, [id]);

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'コースが見つかりません'
      });
    }

    // 関連するレッスンも論理削除
    await connection.execute(`
      UPDATE lessons SET status = 'deleted', updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE course_id = ?
    `, [req.user?.id, id]);

    // コースを論理削除
    await connection.execute(`
      UPDATE courses SET status = 'deleted', updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.user?.id, id]);

    // 操作ログ記録
    await recordOperationLog({
      userId: req.user?.id,
      action: 'delete_course',
      targetType: 'course',
      targetId: id,
      details: { title: existingRows[0].title }
    });

    customLogger.info('Course deleted successfully', {
      courseId: id,
      title: existingRows[0].title,
      userId: req.user?.id
    });

    res.json({
      success: true,
      message: 'コースが正常に削除されました'
    });
  } catch (error) {
    customLogger.error('Failed to delete course', {
      error: error.message,
      courseId: id,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'コースの削除に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// コース順序更新
const updateCourseOrder = async (req, res) => {
  const { courseOrders } = req.body; // [{id: 1, order_index: 1}, ...]
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    for (const course of courseOrders) {
      await connection.execute(`
        UPDATE courses SET order_index = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [course.order_index, req.user?.id, course.id]);
    }

    await connection.commit();

    // 操作ログ記録
    await recordOperationLog({
      userId: req.user?.id,
      action: 'update_course_order',
      targetType: 'course',
      details: { courseOrders }
    });

    customLogger.info('Course order updated successfully', {
      courseCount: courseOrders.length,
      userId: req.user?.id
    });

    res.json({
      success: true,
      message: 'コースの順序が正常に更新されました'
    });
  } catch (error) {
    await connection.rollback();
    
    customLogger.error('Failed to update course order', {
      error: error.message,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'コースの順序更新に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  updateCourseOrder
}; 