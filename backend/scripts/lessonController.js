const { customLogger } = require('../utils/logger');
const { pool } = require('../utils/database');
const { recordOperationLog } = require('./operationLogController');
const { s3Utils } = require('../config/s3');
const multer = require('multer');

// Multer設定（メモリストレージ）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB制限
  },
  fileFilter: (req, file, cb) => {
    // 許可するファイル形式
    const allowedTypes = ['application/pdf', 'text/markdown', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('許可されていないファイル形式です'), false);
    }
  }
});

// レッスン一覧取得
const getLessons = async (req, res) => {
  const { courseId } = req.query;
  const connection = await pool.getConnection();
  
  try {
    let query = `
      SELECT l.*, c.title as course_title
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.status != 'deleted'
    `;
    let params = [];

    if (courseId) {
      query += ' AND l.course_id = ?';
      params.push(courseId);
    }

    query += ' ORDER BY l.course_id ASC, l.order_index ASC';

    const [rows] = await connection.execute(query, params);

    customLogger.info('Lessons retrieved successfully', {
      count: rows.length,
      courseId: courseId,
      userId: req.user?.id
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Failed to retrieve lessons', {
      error: error.message,
      courseId: courseId,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスンの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// レッスン詳細取得
const getLessonById = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT l.*, c.title as course_title
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.id = ? AND l.status != 'deleted'
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'レッスンが見つかりません'
      });
    }

    const lesson = rows[0];

    // S3から署名付きURLを生成（ファイルが存在する場合）
    if (lesson.s3_key) {
      try {
        const urlResult = await s3Utils.generatePresignedUrl(lesson.s3_key, 3600); // 1時間有効
        lesson.download_url = urlResult.url;
      } catch (s3Error) {
        customLogger.warn('Failed to generate presigned URL', {
          error: s3Error.message,
          s3Key: lesson.s3_key
        });
        lesson.download_url = null;
      }
    }

    customLogger.info('Lesson retrieved successfully', {
      lessonId: id,
      courseId: lesson.course_id,
      userId: req.user?.id
    });

    res.json({
      success: true,
      data: lesson
    });
  } catch (error) {
    customLogger.error('Failed to retrieve lesson', {
      error: error.message,
      lessonId: id,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスンの取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// レッスン作成（ファイルアップロード付き）
const createLesson = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { title, description, duration, order_index, has_assignment, course_id, youtube_url } = req.body;
    
    // コース存在確認
    const [courseRows] = await connection.execute(`
      SELECT title FROM courses WHERE id = ? AND status != 'deleted'
    `, [course_id]);

    if (courseRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '指定されたコースが見つかりません'
      });
    }

    const courseTitle = courseRows[0].title;
    let s3Key = null;
    let fileType = null;
    let fileSize = null;

    // ファイルアップロード処理
    if (req.file) {
      const fileName = req.file.originalname;
      const fileExtension = fileName.split('.').pop().toLowerCase();
      
      // ファイル形式の判定
      const fileTypeMap = {
        'pdf': 'pdf',
        'md': 'md',
        'docx': 'docx',
        'pptx': 'pptx'
      };
      
      fileType = fileTypeMap[fileExtension] || 'pdf';
      fileSize = req.file.size;

      // S3にアップロード
      const uploadResult = await s3Utils.uploadFile(
        req.file, 
        courseTitle, 
        title, 
        fileName
      );
      
      s3Key = uploadResult.key;
    }

    // YouTube動画処理
    if (youtube_url) {
      // YouTube URLの基本的な検証
      if (!youtube_url.includes('youtube.com/watch?v=') && !youtube_url.includes('youtu.be/')) {
        return res.status(400).json({
          success: false,
          message: '有効なYouTube URLではありません'
        });
      }
    }

    // レッスンをデータベースに保存
    const [result] = await connection.execute(`
      INSERT INTO lessons (
        course_id, title, description, duration, order_index, 
        has_assignment, s3_key, file_type, file_size, youtube_url, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      course_id, title, description, duration || '120分', order_index || 0,
      has_assignment || false, s3Key, fileType, fileSize, youtube_url, req.user?.id
    ]);

    const lessonId = result.insertId;

    // 操作ログ記録
    await recordOperationLog({
      userId: req.user?.id,
      action: 'create_lesson',
      targetType: 'lesson',
      targetId: lessonId,
      details: { title, courseId: course_id, hasFile: !!req.file }
    });

    customLogger.info('Lesson created successfully', {
      lessonId: lessonId,
      title: title,
      courseId: course_id,
      hasFile: !!req.file,
      userId: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: 'レッスンが正常に作成されました',
      data: { 
        id: lessonId, 
        title, 
        course_id, 
        s3_key: s3Key,
        file_type: fileType,
        file_size: fileSize,
        youtube_url: youtube_url
      }
    });
  } catch (error) {
    customLogger.error('Failed to create lesson', {
      error: error.message,
      title: req.body.title,
      courseId: req.body.course_id,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスンの作成に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// レッスン更新
const updateLesson = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // レッスン存在確認
    const [existingRows] = await connection.execute(`
      SELECT l.*, c.title as course_title
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.id = ? AND l.status != 'deleted'
    `, [id]);

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'レッスンが見つかりません'
      });
    }

    const existingLesson = existingRows[0];
    const { title, description, duration, order_index, has_assignment, status, youtube_url } = req.body;
    
    let s3Key = existingLesson.s3_key;
    let fileType = existingLesson.file_type;
    let fileSize = existingLesson.file_size;

    // 新しいファイルがアップロードされた場合
    if (req.file) {
      // 古いファイルを削除
      if (existingLesson.s3_key) {
        try {
          await s3Utils.deleteFile(existingLesson.s3_key);
        } catch (deleteError) {
          customLogger.warn('Failed to delete old file', {
            error: deleteError.message,
            s3Key: existingLesson.s3_key
          });
        }
      }

      // 新しいファイルをアップロード
      const fileName = req.file.originalname;
      const fileExtension = fileName.split('.').pop().toLowerCase();
      
      const fileTypeMap = {
        'pdf': 'pdf',
        'md': 'md',
        'docx': 'docx',
        'pptx': 'pptx'
      };
      
      fileType = fileTypeMap[fileExtension] || 'pdf';
      fileSize = req.file.size;

      const uploadResult = await s3Utils.uploadFile(
        req.file, 
        existingLesson.course_title, 
        title || existingLesson.title, 
        fileName
      );
      
      s3Key = uploadResult.key;
    }

    // YouTube動画処理
    if (youtube_url) {
      // YouTube URLの基本的な検証
      if (!youtube_url.includes('youtube.com/watch?v=') && !youtube_url.includes('youtu.be/')) {
        return res.status(400).json({
          success: false,
          message: '有効なYouTube URLではありません'
        });
      }
    }

    // レッスンを更新
    await connection.execute(`
      UPDATE lessons 
      SET title = ?, description = ?, duration = ?, order_index = ?, 
          has_assignment = ?, status = ?, s3_key = ?, file_type = ?, 
          file_size = ?, youtube_url = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title, description, duration, order_index, has_assignment, status,
      s3Key, fileType, fileSize, youtube_url, req.user?.id, id
    ]);

    // 操作ログ記録
    await recordOperationLog({
      userId: req.user?.id,
      action: 'update_lesson',
      targetType: 'lesson',
      targetId: id,
      details: { title, hasFile: !!req.file }
    });

    customLogger.info('Lesson updated successfully', {
      lessonId: id,
      title: title,
      hasFile: !!req.file,
      userId: req.user?.id
    });

    res.json({
      success: true,
      message: 'レッスンが正常に更新されました',
      data: { 
        id, 
        title, 
        s3_key: s3Key,
        file_type: fileType,
        file_size: fileSize,
        youtube_url: youtube_url
      }
    });
  } catch (error) {
    customLogger.error('Failed to update lesson', {
      error: error.message,
      lessonId: id,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスンの更新に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// レッスン削除（論理削除）
const deleteLesson = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // レッスン存在確認
    const [existingRows] = await connection.execute(`
      SELECT * FROM lessons WHERE id = ? AND status != 'deleted'
    `, [id]);

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'レッスンが見つかりません'
      });
    }

    const lesson = existingRows[0];

    // S3からファイルを削除
    if (lesson.s3_key) {
      try {
        await s3Utils.deleteFile(lesson.s3_key);
      } catch (deleteError) {
        customLogger.warn('Failed to delete file from S3', {
          error: deleteError.message,
          s3Key: lesson.s3_key
        });
      }
    }

    // レッスンを論理削除
    await connection.execute(`
      UPDATE lessons SET status = 'deleted', updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.user?.id, id]);

    // 操作ログ記録
    await recordOperationLog({
      userId: req.user?.id,
      action: 'delete_lesson',
      targetType: 'lesson',
      targetId: id,
      details: { title: lesson.title }
    });

    customLogger.info('Lesson deleted successfully', {
      lessonId: id,
      title: lesson.title,
      userId: req.user?.id
    });

    res.json({
      success: true,
      message: 'レッスンが正常に削除されました'
    });
  } catch (error) {
    customLogger.error('Failed to delete lesson', {
      error: error.message,
      lessonId: id,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスンの削除に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// レッスン順序更新
const updateLessonOrder = async (req, res) => {
  const { lessonOrders } = req.body; // [{id: 1, order_index: 1}, ...]
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    for (const lesson of lessonOrders) {
      await connection.execute(`
        UPDATE lessons SET order_index = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [lesson.order_index, req.user?.id, lesson.id]);
    }

    await connection.commit();

    // 操作ログ記録
    await recordOperationLog({
      userId: req.user?.id,
      action: 'update_lesson_order',
      targetType: 'lesson',
      details: { lessonOrders }
    });

    customLogger.info('Lesson order updated successfully', {
      lessonCount: lessonOrders.length,
      userId: req.user?.id
    });

    res.json({
      success: true,
      message: 'レッスンの順序が正常に更新されました'
    });
  } catch (error) {
    await connection.rollback();
    
    customLogger.error('Failed to update lesson order', {
      error: error.message,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスンの順序更新に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ファイルダウンロード
const downloadLessonFile = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT s3_key, file_type, title FROM lessons 
      WHERE id = ? AND status != 'deleted'
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'レッスンが見つかりません'
      });
    }

    const lesson = rows[0];

    if (!lesson.s3_key) {
      return res.status(404).json({
        success: false,
        message: 'ファイルがアップロードされていません'
      });
    }

    // S3からファイルをダウンロード
    const downloadResult = await s3Utils.downloadFile(lesson.s3_key);

    // レスポンスヘッダー設定
    const contentType = downloadResult.contentType || 'application/octet-stream';
    const fileName = lesson.s3_key.split('/').pop();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', downloadResult.data.length);

    res.send(downloadResult.data);

    customLogger.info('Lesson file downloaded successfully', {
      lessonId: id,
      fileName: fileName,
      userId: req.user?.id
    });
  } catch (error) {
    customLogger.error('Failed to download lesson file', {
      error: error.message,
      lessonId: id,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'ファイルのダウンロードに失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getLessons,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  updateLessonOrder,
  downloadLessonFile,
  upload
}; 
