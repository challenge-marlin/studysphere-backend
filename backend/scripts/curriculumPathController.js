const { customLogger } = require('../utils/logger');
const { pool } = require('../utils/database');
const { recordOperationLogDirect } = require('./operationLogController');

// カリキュラムパス一覧取得
const getCurriculumPaths = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    // パス一覧を取得
    const [pathRows] = await connection.execute(`
      SELECT 
        cp.*,
        COUNT(cpc.course_id) as total_courses
      FROM curriculum_paths cp
      LEFT JOIN curriculum_path_courses cpc ON cp.id = cpc.curriculum_path_id
      WHERE cp.status != 'deleted'
      GROUP BY cp.id
      ORDER BY cp.created_at DESC
    `);

    // 各パスのコース情報を取得
    const rows = [];
    for (const path of pathRows) {
      const [courseRows] = await connection.execute(`
        SELECT 
          cpc.*,
          c.title as course_title,
          c.description as course_description,
          c.category as course_category
        FROM curriculum_path_courses cpc
        JOIN courses c ON cpc.course_id = c.id
        WHERE cpc.curriculum_path_id = ? AND c.status != 'deleted'
        ORDER BY cpc.order_index ASC
      `, [path.id]);
      
      path.courses = courseRows;
      rows.push(path);
    }

    customLogger.info('Curriculum paths retrieved successfully', {
      count: rows.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Failed to retrieve curriculum paths', {
      error: error.message,
      userId: req.user?.user_id
    });
    
    res.status(500).json({
      success: false,
      message: 'カリキュラムパスの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// カリキュラムパス詳細取得（コース情報含む）
const getCurriculumPathById = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // パス情報取得
    const [pathRows] = await connection.execute(`
      SELECT * FROM curriculum_paths WHERE id = ? AND status != 'deleted'
    `, [id]);

    if (pathRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'カリキュラムパスが見つかりません'
      });
    }

    // 関連コース情報取得
    const [courseRows] = await connection.execute(`
      SELECT 
        cpc.*,
        c.title as course_title,
        c.description as course_description,
        c.category as course_category
      FROM curriculum_path_courses cpc
      JOIN courses c ON cpc.course_id = c.id
      WHERE cpc.curriculum_path_id = ? AND c.status != 'deleted'
      ORDER BY cpc.order_index ASC
    `, [id]);

    const path = pathRows[0];
    path.courses = courseRows;

    customLogger.info('Curriculum path retrieved successfully', {
      pathId: id,
      courseCount: courseRows.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: path
    });
  } catch (error) {
    customLogger.error('Failed to retrieve curriculum path', {
      error: error.message,
      pathId: id,
      userId: req.user?.user_id
    });
    
    res.status(500).json({
      success: false,
      message: 'カリキュラムパスの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// カリキュラムパス作成
const createCurriculumPath = async (req, res) => {
  const { name, description, target_audience, duration, status, courses } = req.body;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // パス作成
    const [pathResult] = await connection.execute(`
      INSERT INTO curriculum_paths (name, description, target_audience, duration, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name, description, target_audience, duration, status || 'draft', req.user?.user_id || 1]);

    const pathId = pathResult.insertId;

    // 関連コース作成
    if (courses && Array.isArray(courses)) {
      for (const course of courses) {
        // courseIdまたはidのどちらかを使用
        const courseId = course.courseId || course.id;
        if (!courseId) {
          console.error('Course ID not found:', course);
          continue;
        }
        
        await connection.execute(`
          INSERT INTO curriculum_path_courses 
          (curriculum_path_id, course_id, order_index, is_required, estimated_duration)
          VALUES (?, ?, ?, ?, ?)
        `, [
          pathId,
          courseId,
          course.order || course.order_index || 1,
          course.isRequired !== false,
          course.estimatedDuration || '3ヶ月'
        ]);
      }
    }

    await connection.commit();

    // 操作ログ記録
    if (req.user?.user_id) {
      await recordOperationLogDirect({
        userId: req.user.user_id,
        action: 'create_curriculum_path',
        targetType: 'curriculum_path',
        targetId: pathId,
        details: { name, courseCount: courses?.length || 0 }
      });
    }

    customLogger.info('Curriculum path created successfully', {
      pathId: pathId,
      name: name,
      userId: req.user?.user_id
    });

    res.status(201).json({
      success: true,
      message: 'カリキュラムパスが正常に作成されました',
      data: { id: pathId, name, description, target_audience, duration, status }
    });
  } catch (error) {
    await connection.rollback();
    
    customLogger.error('Failed to create curriculum path', {
      error: error.message,
      name: name,
      userId: req.user?.user_id
    });
    
    res.status(500).json({
      success: false,
      message: 'カリキュラムパスの作成に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// カリキュラムパス更新
const updateCurriculumPath = async (req, res) => {
  const { id } = req.params;
  const { name, description, target_audience, duration, status, courses } = req.body;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // パス存在確認
    const [existingRows] = await connection.execute(`
      SELECT * FROM curriculum_paths WHERE id = ? AND status != 'deleted'
    `, [id]);

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'カリキュラムパスが見つかりません'
      });
    }

    // パス情報更新
    await connection.execute(`
      UPDATE curriculum_paths 
      SET name = ?, description = ?, target_audience = ?, duration = ?, status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, description, target_audience, duration, status, req.user?.user_id, id]);

    // 既存の関連コースを削除
    await connection.execute(`
      DELETE FROM curriculum_path_courses WHERE curriculum_path_id = ?
    `, [id]);

    // 新しい関連コースを作成
    if (courses && Array.isArray(courses)) {
      for (const course of courses) {
        // courseIdまたはidのどちらかを使用
        const courseId = course.courseId || course.id;
        if (!courseId) {
          console.error('Course ID not found:', course);
          continue;
        }
        
        await connection.execute(`
          INSERT INTO curriculum_path_courses 
          (curriculum_path_id, course_id, order_index, is_required, estimated_duration)
          VALUES (?, ?, ?, ?, ?)
        `, [
          id,
          courseId,
          course.order || course.order_index || 1,
          course.isRequired !== false,
          course.estimatedDuration || '3ヶ月'
        ]);
      }
    }

    await connection.commit();

    // 操作ログ記録
    await recordOperationLogDirect({
      userId: req.user?.user_id,
      action: 'update_curriculum_path',
      targetType: 'curriculum_path',
      targetId: id,
      details: { name, courseCount: courses?.length || 0 }
    });

    customLogger.info('Curriculum path updated successfully', {
      pathId: id,
      name: name,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      message: 'カリキュラムパスが正常に更新されました',
      data: { id, name, description, target_audience, duration, status }
    });
  } catch (error) {
    await connection.rollback();
    
    customLogger.error('Failed to update curriculum path', {
      error: error.message,
      pathId: id,
      userId: req.user?.user_id
    });
    
    res.status(500).json({
      success: false,
      message: 'カリキュラムパスの更新に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// カリキュラムパス削除（論理削除）
const deleteCurriculumPath = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // パス存在確認
    const [existingRows] = await connection.execute(`
      SELECT * FROM curriculum_paths WHERE id = ? AND status != 'deleted'
    `, [id]);

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'カリキュラムパスが見つかりません'
      });
    }

    // 論理削除
    await connection.execute(`
      UPDATE curriculum_paths SET status = 'deleted', updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.user?.user_id, id]);

    // 操作ログ記録
    await recordOperationLogDirect({
      userId: req.user?.user_id,
      action: 'delete_curriculum_path',
      targetType: 'curriculum_path',
      targetId: id,
      details: { name: existingRows[0].name }
    });

    customLogger.info('Curriculum path deleted successfully', {
      pathId: id,
      name: existingRows[0].name,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      message: 'カリキュラムパスが正常に削除されました'
    });
  } catch (error) {
    customLogger.error('Failed to delete curriculum path', {
      error: error.message,
      pathId: id,
      userId: req.user?.user_id
    });
    
    res.status(500).json({
      success: false,
      message: 'カリキュラムパスの削除に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// 利用可能なコース一覧取得
const getAvailableCourses = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT id, title, description, category, status
      FROM courses 
      WHERE status = 'active'
      ORDER BY order_index ASC, title ASC
    `);

    customLogger.info('Available courses retrieved successfully', {
      count: rows.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Failed to retrieve available courses', {
      error: error.message,
      userId: req.user?.user_id
    });
    
    res.status(500).json({
      success: false,
      message: '利用可能なコースの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getCurriculumPaths,
  getCurriculumPathById,
  createCurriculumPath,
  updateCurriculumPath,
  deleteCurriculumPath,
  getAvailableCourses
};
