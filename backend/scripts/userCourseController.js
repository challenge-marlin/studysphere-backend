const { customLogger } = require('../utils/logger');
const { pool } = require('../utils/database');
const { recordOperationLogDirect } = require('./operationLogController');

/**
 * 拠点内の利用者のコース関連付け一覧を取得
 */
const getSatelliteUserCourses = async (req, res) => {
  const { satelliteId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT 
        uc.id,
        uc.user_id,
        u.name as user_name,
        uc.course_id,
        c.title as course_title,
        c.description as course_description,
        c.category as course_category,
        uc.curriculum_path_id,
        cp.name as curriculum_path_name,
        uc.assigned_by,
        assigner.name as assigned_by_name,
        uc.assigned_at,
        uc.status,
        uc.start_date,
        uc.completion_date,
        uc.progress_percentage,
        uc.notes
      FROM user_courses uc
      JOIN user_accounts u ON uc.user_id = u.id
      JOIN courses c ON uc.course_id = c.id
      LEFT JOIN curriculum_paths cp ON uc.curriculum_path_id = cp.id
      LEFT JOIN user_accounts assigner ON uc.assigned_by = assigner.id
      WHERE u.role = 1 
        AND JSON_CONTAINS(u.satellite_ids, ?)
        AND u.status = 1
        AND c.status != 'deleted'
      ORDER BY u.name, c.title
    `, [JSON.stringify(parseInt(satelliteId))]);
    
    customLogger.info('Satellite user courses retrieved successfully', {
      satelliteId,
      count: rows.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Failed to retrieve satellite user courses', {
      error: error.message,
      satelliteId,
      userId: req.user?.user_id
    });
    
    res.status(500).json({
      success: false,
      message: '利用者のコース関連付けの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 拠点で利用可能なコース一覧を取得（拠点の無効化コースを除外）
 */
const getSatelliteAvailableCourses = async (req, res) => {
  const { satelliteId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // 拠点の無効化コースIDを取得
    let disabledCourseIds = [];
    const [satRows] = await connection.execute(
      'SELECT disabled_course_ids FROM satellites WHERE id = ?', 
      [satelliteId]
    );
    
    if (satRows.length > 0 && satRows[0].disabled_course_ids) {
      try {
        disabledCourseIds = Array.isArray(satRows[0].disabled_course_ids)
          ? satRows[0].disabled_course_ids
          : JSON.parse(satRows[0].disabled_course_ids);
      } catch (e) {
        disabledCourseIds = [];
      }
    }

    // 利用可能なコースを取得
    const baseSql = `
      SELECT 
        c.id,
        c.title,
        c.description,
        c.category,
        c.status,
        COUNT(CASE WHEN l.status != 'deleted' THEN 1 END) as lesson_count
      FROM courses c
      LEFT JOIN lessons l ON c.id = l.course_id
      WHERE c.status = 'active'
      ${disabledCourseIds.length > 0 ? `AND c.id NOT IN (${disabledCourseIds.map(() => '?').join(',')})` : ''}
      GROUP BY c.id
      ORDER BY c.order_index ASC, c.title ASC
    `;

    const params = disabledCourseIds.length > 0 ? disabledCourseIds : [];
    const [rows] = await connection.execute(baseSql, params);

    customLogger.info('Satellite available courses retrieved successfully', {
      satelliteId,
      count: rows.length,
      disabledCourseCount: disabledCourseIds.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Failed to retrieve satellite available courses', {
      error: error.message,
      satelliteId,
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

/**
 * 拠点で利用可能なカリキュラムパス一覧を取得
 */
const getSatelliteAvailableCurriculumPaths = async (req, res) => {
  const { satelliteId } = req.params;
  let connection;
  
  try {
    // 接続プールから接続を取得
    connection = await pool.getConnection();
    
    // 拠点の無効化コースIDを取得
    let disabledCourseIds = [];
    const [satRows] = await connection.execute(
      'SELECT disabled_course_ids FROM satellites WHERE id = ?', 
      [satelliteId]
    );
    
    if (satRows.length > 0 && satRows[0].disabled_course_ids) {
      try {
        disabledCourseIds = Array.isArray(satRows[0].disabled_course_ids)
          ? satRows[0].disabled_course_ids
          : JSON.parse(satRows[0].disabled_course_ids);
      } catch (e) {
        disabledCourseIds = [];
      }
    }

    // カリキュラムパス一覧を取得
    const [pathRows] = await connection.execute(`
      SELECT 
        cp.*,
        COUNT(cpc.course_id) as total_courses
      FROM curriculum_paths cp
      LEFT JOIN curriculum_path_courses cpc ON cp.id = cpc.curriculum_path_id
      WHERE cp.status = 'active'
      GROUP BY cp.id
      ORDER BY cp.created_at DESC
    `);

    // 各パスのコース情報を取得し、無効化コースを含むパスを除外
    const availablePaths = [];
    for (const path of pathRows) {
      const [courseRows] = await connection.execute(`
        SELECT 
          cpc.*,
          c.title as course_title,
          c.description as course_description,
          c.category as course_category
        FROM curriculum_path_courses cpc
        JOIN courses c ON cpc.course_id = c.id
        WHERE cpc.curriculum_path_id = ? AND c.status = 'active'
        ORDER BY cpc.order_index ASC
      `, [path.id]);
      
      // 無効化コースが含まれているかチェック
      const hasDisabledCourse = courseRows.some(course => 
        disabledCourseIds.includes(course.course_id)
      );
      
      if (!hasDisabledCourse) {
        path.courses = courseRows;
        availablePaths.push(path);
      }
    }

    customLogger.info('Satellite available curriculum paths retrieved successfully', {
      satelliteId,
      count: availablePaths.length,
      disabledCourseCount: disabledCourseIds.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      data: availablePaths
    });
  } catch (error) {
    customLogger.error('Failed to retrieve satellite available curriculum paths', {
      error: error.message,
      satelliteId,
      userId: req.user?.user_id
    });
    
    res.status(500).json({
      success: false,
      message: '利用可能なカリキュラムパスの取得に失敗しました',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * 利用者にコースを一括追加
 */
const bulkAssignCoursesToUsers = async (req, res) => {
  const { satelliteId } = req.params;
  const { userIds, courseIds, curriculumPathId, notes } = req.body;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const assignments = [];
    const errors = [];

    for (const userId of userIds) {
      for (const courseId of courseIds) {
        try {
          // 既存の関連付けをチェック
          const [existingRows] = await connection.execute(
            'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
          );

          if (existingRows.length === 0) {
            // 新しい関連付けを作成
            await connection.execute(`
              INSERT INTO user_courses 
              (user_id, course_id, curriculum_path_id, assigned_by, notes)
              VALUES (?, ?, ?, ?, ?)
            `, [userId, courseId, curriculumPathId || null, req.user?.user_id, notes || null]);
            
            assignments.push({ userId, courseId });
          } else {
            errors.push(`利用者ID ${userId} のコースID ${courseId} は既に割り当て済みです`);
          }
        } catch (error) {
          errors.push(`利用者ID ${userId} のコースID ${courseId} の割り当てに失敗: ${error.message}`);
        }
      }
    }

    await connection.commit();

    // 操作ログ記録
    if (req.user?.user_id) {
      await recordOperationLogDirect({
        userId: req.user.user_id,
        action: 'bulk_assign_courses',
        targetType: 'satellite',
        targetId: satelliteId,
        details: { 
          userIds, 
          courseIds, 
          curriculumPathId,
          assignmentCount: assignments.length,
          errorCount: errors.length
        }
      });
    }

    customLogger.info('Bulk course assignment completed', {
      satelliteId,
      assignmentCount: assignments.length,
      errorCount: errors.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      message: `${assignments.length}件のコース割り当てが完了しました`,
      data: {
        assignments,
        errors
      }
    });
  } catch (error) {
    await connection.rollback();
    
    customLogger.error('Failed to bulk assign courses', {
      error: error.message,
      satelliteId,
      userId: req.user?.user_id
    });
    
    res.status(500).json({
      success: false,
      message: 'コースの一括割り当てに失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 利用者からコースを一括削除
 */
const bulkRemoveCoursesFromUsers = async (req, res) => {
  const { satelliteId } = req.params;
  const { userIds, courseIds } = req.body;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    let removedCount = 0;
    const errors = [];

    for (const userId of userIds) {
      for (const courseId of courseIds) {
        try {
          const [result] = await connection.execute(
            'DELETE FROM user_courses WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
          );
          
          if (result.affectedRows > 0) {
            removedCount++;
          }
        } catch (error) {
          errors.push(`利用者ID ${userId} のコースID ${courseId} の削除に失敗: ${error.message}`);
        }
      }
    }

    await connection.commit();

    // 操作ログ記録
    if (req.user?.user_id) {
      await recordOperationLogDirect({
        userId: req.user.user_id,
        action: 'bulk_remove_courses',
        targetType: 'satellite',
        targetId: satelliteId,
        details: { 
          userIds, 
          courseIds, 
          removedCount,
          errorCount: errors.length
        }
      });
    }

    customLogger.info('Bulk course removal completed', {
      satelliteId,
      removedCount,
      errorCount: errors.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      message: `${removedCount}件のコース割り当てを削除しました`,
      data: {
        removedCount,
        errors
      }
    });
  } catch (error) {
    await connection.rollback();
    
    customLogger.error('Failed to bulk remove courses', {
      error: error.message,
      satelliteId,
      userId: req.user?.user_id
    });
    
    res.status(500).json({
      success: false,
      message: 'コースの一括削除に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * 利用者にカリキュラムパスを一括追加
 */
const bulkAssignCurriculumPathsToUsers = async (req, res) => {
  const { satelliteId } = req.params;
  const { userIds, curriculumPathId, notes } = req.body;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // カリキュラムパスのコース一覧を取得
    const [courseRows] = await connection.execute(`
      SELECT course_id FROM curriculum_path_courses 
      WHERE curriculum_path_id = ?
      ORDER BY order_index ASC
    `, [curriculumPathId]);

    if (courseRows.length === 0) {
      throw new Error('カリキュラムパスにコースが含まれていません');
    }

    const courseIds = courseRows.map(row => row.course_id);
    const assignments = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        // 既存のカリキュラムパス関連付けをチェック
        const [existingPathRows] = await connection.execute(
          'SELECT id FROM user_curriculum_paths WHERE user_id = ? AND curriculum_path_id = ?',
          [userId, curriculumPathId]
        );

        if (existingPathRows.length === 0) {
          // カリキュラムパス関連付けを作成
          await connection.execute(`
            INSERT INTO user_curriculum_paths 
            (user_id, curriculum_path_id, assigned_by, notes)
            VALUES (?, ?, ?, ?)
          `, [userId, curriculumPathId, req.user?.user_id, notes || null]);
        }

        // 各コースを追加
        for (const courseId of courseIds) {
          try {
            // 既存のコース関連付けをチェック
            const [existingCourseRows] = await connection.execute(
              'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
              [userId, courseId]
            );

            if (existingCourseRows.length === 0) {
              // 新しいコース関連付けを作成
              await connection.execute(`
                INSERT INTO user_courses 
                (user_id, course_id, curriculum_path_id, assigned_by, notes)
                VALUES (?, ?, ?, ?, ?)
              `, [userId, courseId, curriculumPathId, req.user?.user_id, notes || null]);
              
              assignments.push({ userId, courseId });
            }
          } catch (error) {
            errors.push(`利用者ID ${userId} のコースID ${courseId} の割り当てに失敗: ${error.message}`);
          }
        }
      } catch (error) {
        errors.push(`利用者ID ${userId} のカリキュラムパス割り当てに失敗: ${error.message}`);
      }
    }

    await connection.commit();

    // 操作ログ記録
    if (req.user?.user_id) {
      await recordOperationLogDirect({
        userId: req.user.user_id,
        action: 'bulk_assign_curriculum_path',
        targetType: 'satellite',
        targetId: satelliteId,
        details: { 
          userIds, 
          curriculumPathId,
          courseCount: courseIds.length,
          assignmentCount: assignments.length,
          errorCount: errors.length
        }
      });
    }

    customLogger.info('Bulk curriculum path assignment completed', {
      satelliteId,
      curriculumPathId,
      assignmentCount: assignments.length,
      errorCount: errors.length,
      userId: req.user?.user_id
    });

    res.json({
      success: true,
      message: `${assignments.length}件のコース割り当てが完了しました`,
      data: {
        assignments,
        errors
      }
    });
  } catch (error) {
    await connection.rollback();
    
    customLogger.error('Failed to bulk assign curriculum path', {
      error: error.message,
      satelliteId,
      curriculumPathId,
      userId: req.user?.user_id
    });
    
    res.status(500).json({
      success: false,
      message: 'カリキュラムパスの一括割り当てに失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getSatelliteUserCourses,
  getSatelliteAvailableCourses,
  getSatelliteAvailableCurriculumPaths,
  bulkAssignCoursesToUsers,
  bulkRemoveCoursesFromUsers,
  bulkAssignCurriculumPathsToUsers
};
