const { customLogger } = require('../utils/logger');
const { pool } = require('../utils/database');
const { recordOperationLogDirect } = require('./operationLogController');
const { s3Utils, encodeRFC5987, encodeFileName } = require('../config/s3');
const multer = require('multer');

// ファイル名を安全な形式に変換する関数
const sanitizeFileName = (originalname) => {
  if (!originalname) return 'file';
  // 日本語文字は保持し、S3で問題となる特殊文字のみを置換
  return originalname
    .replace(/[<>:"|?*]/g, '_') // S3で使用できない文字をアンダースコアに変換
    .replace(/\\/g, '_') // バックスラッシュをアンダースコアに変換
    .trim() // 前後の空白を削除
    .substring(0, 255); // 長さ制限
};

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
      // ファイル名の処理は無効化（フロントエンドから送信されるファイル名を使用）
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
      userId: req.user?.user_id || null
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Failed to retrieve lessons', {
      error: error.message,
      courseId: courseId,
      userId: req.user?.user_id || null
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
      userId: req.user?.user_id || null
    });

    res.json({
      success: true,
      data: lesson
    });
  } catch (error) {
    customLogger.error('Failed to retrieve lesson', {
      error: error.message,
      lessonId: id,
      userId: req.user?.user_id || null
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
    const { title, description, duration, order_index, has_assignment, course_id, youtube_url, fileName: originalFileName } = req.body;
    
    // 必須パラメータの検証
    if (!title || !course_id) {
      return res.status(400).json({
        success: false,
        message: 'タイトルとコースIDは必須です'
      });
    }

    // ファイルアップロードの必須チェック
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'ファイルのアップロードは必須です'
      });
    }

    // ファイル名の必須チェック
    if (!originalFileName) {
      return res.status(400).json({
        success: false,
        message: 'ファイル名は必須です'
      });
    }

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

    // ファイルアップロード処理（必須）
    const fileName = originalFileName || req.file.originalname;
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

    // S3にアップロード（必須）
    const uploadResult = await s3Utils.uploadFile(
      req.file, 
      courseTitle, 
      title, 
      fileName
    );
    
    s3Key = uploadResult.key;
    
    customLogger.info('File uploaded to S3 successfully', {
      fileName: fileName,
      s3Key: s3Key,
      fileSize: fileSize,
      fileType: fileType
    });

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

    // データベース挿入用の値を準備（undefined値を適切な値に変換）
    const insertValues = [
      course_id,
      title,
      description || null,
      duration || '120分',
      order_index || 0,
      has_assignment === 'true' || has_assignment === true ? 1 : 0,
      s3Key,
      fileType,
      fileSize,
      youtube_url || null,
      req.user?.user_id || null
    ];

    // レッスンをデータベースに保存
    const [result] = await connection.execute(`
      INSERT INTO lessons (
        course_id, title, description, duration, order_index, 
        has_assignment, s3_key, file_type, file_size, youtube_url, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, insertValues);

    const lessonId = result.insertId;

    // 操作ログ記録
    try {
      await recordOperationLogDirect({
        userId: req.user?.user_id || null,
        action: 'create_lesson',
        targetType: 'lesson',
        targetId: lessonId,
        details: { title, courseId: course_id, courseTitle: courseTitle, hasFile: true },
        ipAddress: req.ip
      });
    } catch (logError) {
      customLogger.warn('操作ログ記録に失敗しましたが、レッスン作成は続行します', {
        error: logError.message,
        lessonId: lessonId,
        userId: req.user?.user_id || null
      });
    }

    customLogger.info('Lesson created successfully', {
      lessonId: lessonId,
      title: title,
      courseId: course_id,
      hasFile: true,
      userId: req.user?.user_id || null
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
      userId: req.user?.user_id || null
    });
    
    // S3アップロードエラーの場合は特別なメッセージを返す
    if (error.message.includes('S3 upload failed') || error.message.includes('Invalid character in header')) {
      return res.status(500).json({
        success: false,
        message: 'ファイルのアップロードに失敗しました。ファイル名に特殊文字が含まれていないか確認してください。',
        error: error.message
      });
    }
    
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
    // リクエスト内容をログ出力
    customLogger.info('Lesson update request received', {
      lessonId: id,
      body: req.body,
      hasFile: !!req.file,
      fileInfo: req.file ? {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : null,
      userId: req.user?.user_id || null
    });

    // レッスン存在確認
    const [existingRows] = await connection.execute(`
      SELECT l.*, c.title as course_title
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.id = ? AND l.status != 'deleted'
    `, [id]);

    if (existingRows.length === 0) {
      customLogger.warn('Lesson not found for update', { lessonId: id });
      return res.status(404).json({
        success: false,
        message: 'レッスンが見つかりません'
      });
    }

    const existingLesson = existingRows[0];
    const { title, description, duration, order_index, has_assignment, status, youtube_url, fileName: originalFileName, update_file, remove_file } = req.body;
    
    // 変更されたフィールドのみを更新するための処理
    const updateFields = [];
    const updateValues = [];
    
    // タイトルの更新
    if (title !== undefined && title !== null && title !== existingLesson.title) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }
    
    // 説明の更新
    if (description !== undefined && description !== existingLesson.description) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    
    // 所要時間の更新
    if (duration !== undefined && duration !== null && duration !== existingLesson.duration) {
      updateFields.push('duration = ?');
      updateValues.push(duration);
    }
    
    // 表示順序の更新
    if (order_index !== undefined && order_index !== null && parseInt(order_index) !== existingLesson.order_index) {
      updateFields.push('order_index = ?');
      updateValues.push(parseInt(order_index));
    }
    
    // 課題の更新
    if (has_assignment !== undefined && has_assignment !== null) {
      const newHasAssignment = has_assignment === 'true' || has_assignment === true;
      if (newHasAssignment !== existingLesson.has_assignment) {
        updateFields.push('has_assignment = ?');
        updateValues.push(newHasAssignment);
      }
    }
    
    // ステータスの更新
    if (status !== undefined && status !== null && status !== existingLesson.status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    
    // YouTube URLの更新
    if (youtube_url !== undefined && youtube_url !== existingLesson.youtube_url) {
      updateFields.push('youtube_url = ?');
      updateValues.push(youtube_url);
    }
    
    // ファイル更新フラグ処理
    const shouldUpdateFile = update_file === 'true' || update_file === true;
    const shouldRemoveFile = remove_file === 'true' || remove_file === true;

    if (shouldUpdateFile && req.file) {
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
      const fileName = originalFileName || req.file.originalname;
      const fileExtension = fileName.split('.').pop().toLowerCase();
      
      const fileTypeMap = {
        'pdf': 'pdf',
        'md': 'md',
        'docx': 'docx',
        'pptx': 'pptx'
      };
      
      const newFileType = fileTypeMap[fileExtension] || 'pdf';
      const newFileSize = req.file.size;

      try {
        const uploadResult = await s3Utils.uploadFile(
          req.file, 
          existingLesson.course_title, 
          title || existingLesson.title, 
          fileName
        );
        
        updateFields.push('s3_key = ?');
        updateFields.push('file_type = ?');
        updateFields.push('file_size = ?');
        updateValues.push(uploadResult.key);
        updateValues.push(newFileType);
        updateValues.push(newFileSize);
      } catch (uploadError) {
        customLogger.warn('S3 upload failed, continuing without file upload', {
          error: uploadError.message,
          fileName: fileName,
          title: title || existingLesson.title
        });
        // S3アップロードが失敗してもレッスン更新は続行
      }
    } else if (shouldUpdateFile && !req.file && shouldRemoveFile) {
      // ファイル削除のみ（新規ファイルなし）
      if (existingLesson.s3_key) {
        try {
          await s3Utils.deleteFile(existingLesson.s3_key);
          updateFields.push('s3_key = ?');
          updateFields.push('file_type = ?');
          updateFields.push('file_size = ?');
          updateValues.push(null);
          updateValues.push(null);
          updateValues.push(null);
        } catch (deleteError) {
          customLogger.warn('Failed to delete file during remove request', {
            error: deleteError.message,
            s3Key: existingLesson.s3_key
          });
        }
      } else {
        // もともと無い場合もDBを明示的にクリア
        updateFields.push('s3_key = ?');
        updateFields.push('file_type = ?');
        updateFields.push('file_size = ?');
        updateValues.push(null);
        updateValues.push(null);
        updateValues.push(null);
      }
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

    // 更新するフィールドがある場合のみ更新を実行
    if (updateFields.length > 0) {
      updateFields.push('updated_by = ?');
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(req.user?.user_id || null);
      updateValues.push(id);

      customLogger.info('Updating lesson fields', {
        lessonId: id,
        updateFields: updateFields.slice(0, -2), // updated_byとupdated_atを除く
        updateValues: updateValues.slice(0, -2),
        hasFile: !!req.file
      });

      await connection.execute(`
        UPDATE lessons 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, updateValues);
    } else {
      customLogger.info('No fields to update for lesson', {
        lessonId: id,
        hasFile: !!req.file
      });
    }

    // 操作ログ記録
    try {
      await recordOperationLogDirect({
        userId: req.user?.user_id || null,
        action: 'update_lesson',
        targetType: 'lesson',
        targetId: id,
        details: { title: title || existingLesson.title, hasFile: !!req.file, courseTitle: existingLesson.course_title },
        ipAddress: req.ip
      });
    } catch (logError) {
      customLogger.warn('操作ログ記録に失敗しましたが、レッスン更新は続行します', {
        error: logError.message,
        lessonId: id,
          userId: req.user?.user_id || null
      });
    }

    customLogger.info('Lesson updated successfully', {
      lessonId: id,
      title: title,
      hasFile: !!req.file,
      userId: req.user?.user_id || null
    });

    // 更新されたレッスン情報を取得
    const [updatedRows] = await connection.execute(`
      SELECT l.*, c.title as course_title
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.id = ? AND l.status != 'deleted'
    `, [id]);

    const updatedLesson = updatedRows[0];

    res.json({
      success: true,
      message: 'レッスンが正常に更新されました',
      data: { 
        id, 
        title: updatedLesson.title, 
        s3_key: updatedLesson.s3_key,
        file_type: updatedLesson.file_type,
        file_size: updatedLesson.file_size,
        youtube_url: updatedLesson.youtube_url
      }
    });
  } catch (error) {
    customLogger.error('Failed to update lesson', {
      error: error.message,
      stack: error.stack,
      lessonId: id,
      userId: req.user?.user_id || null,
      body: req.body
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

    const lesson = existingRows[0];

    // S3からファイルのみを削除（/lessonsディレクトリは削除しない）
    if (lesson.s3_key) {
      try {
        // 個別ファイルのみを削除
        await s3Utils.deleteFile(lesson.s3_key);
        
        customLogger.info('S3 file deleted successfully', {
          lessonId: id,
          s3Key: lesson.s3_key
        });
      } catch (deleteError) {
        customLogger.warn('Failed to delete file from S3', {
          error: deleteError.message,
          s3Key: lesson.s3_key,
          lessonId: id
        });
        // S3削除エラーでもレッスン削除は続行
      }
    }

    // レッスンを論理削除
    await connection.execute(`
      UPDATE lessons SET status = 'deleted', updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.user?.user_id || null, id]);

    // 操作ログ記録
    try {
      await recordOperationLogDirect({
        userId: req.user?.user_id || null,
        action: 'delete_lesson',
        targetType: 'lesson',
        targetId: id,
        details: { 
          title: lesson.title,
          courseTitle: lesson.course_title,
          hasS3File: !!lesson.s3_key
        },
        ipAddress: req.ip
      });
    } catch (logError) {
      customLogger.warn('操作ログ記録に失敗しましたが、レッスン削除は続行します', {
        error: logError.message,
        lessonId: id,
        userId: req.user?.id || null
      });
    }

    customLogger.info('Lesson deleted successfully', {
      lessonId: id,
      title: lesson.title,
      courseTitle: lesson.course_title,
      userId: req.user?.user_id || null,
      hasS3File: !!lesson.s3_key
    });

    res.json({
      success: true,
      message: 'レッスンが正常に削除されました',
      data: {
        lessonId: id,
        title: lesson.title,
        courseTitle: lesson.course_title
      }
    });
  } catch (error) {
    customLogger.error('Failed to delete lesson', {
      error: error.message,
      lessonId: id,
      userId: req.user?.user_id || null
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
      `, [lesson.order_index, req.user?.user_id || null, lesson.id]);
    }

    await connection.commit();

    // 操作ログ記録
    try {
      await recordOperationLogDirect({
        userId: req.user?.user_id || null,
        action: 'update_lesson_order',
        targetType: 'lesson',
        details: { lessonOrders }
      });
    } catch (logError) {
      customLogger.warn('操作ログ記録に失敗しましたが、レッスン順序更新は続行します', {
        error: logError.message,
        userId: req.user?.user_id || null
      });
    }

    customLogger.info('Lesson order updated successfully', {
      lessonCount: lessonOrders.length,
      userId: req.user?.user_id || null
    });

    res.json({
      success: true,
      message: 'レッスンの順序が正常に更新されました'
    });
  } catch (error) {
    await connection.rollback();
    
    customLogger.error('Failed to update lesson order', {
      error: error.message,
      userId: req.user?.user_id || null
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
      SELECT l.s3_key, l.file_type, l.title, c.title as course_title
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
    
    // メタデータから元のファイル名を取得、なければS3キーから抽出
    let fileName = lesson.title || lesson.s3_key.split('/').pop();
    if (downloadResult.metadata && downloadResult.metadata['original-name']) {
      fileName = downloadResult.metadata['original-name'];
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeRFC5987(fileName)}`);
    res.setHeader('Content-Length', downloadResult.data.length);

    res.send(downloadResult.data);

    customLogger.info('Lesson file downloaded successfully', {
      lessonId: id,
      fileName: fileName,
      userId: req.user?.user_id || null
    });
  } catch (error) {
    customLogger.error('Failed to download lesson file', {
      error: error.message,
      lessonId: id,
      userId: req.user?.user_id || null
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

  // レッスンフォルダダウンロード（ZIP形式）
  const downloadLessonFolder = async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(`
        SELECT l.s3_key, l.title, c.title as course_title
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

      if (!lesson.s3_key) {
        return res.status(404).json({
          success: false,
          message: 'ファイルがアップロードされていません'
        });
      }

      // S3キーからフォルダプレフィックスを抽出
      const folderPrefix = lesson.s3_key.substring(0, lesson.s3_key.lastIndexOf('/'));
      
      // フォルダ名を決定
      const folderName = `${lesson.course_title}_${lesson.title}`;

      // S3からフォルダをダウンロード（ZIP形式）
      const downloadResult = await s3Utils.downloadFolder(folderPrefix, folderName);

      if (!downloadResult.success) {
        return res.status(404).json({
          success: false,
          message: downloadResult.message
        });
      }

      // レスポンスヘッダー設定
      res.setHeader('Content-Type', downloadResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeRFC5987(downloadResult.fileName)}`);
      res.setHeader('Content-Length', downloadResult.data.length);

      res.send(downloadResult.data);

      customLogger.info('Lesson folder downloaded successfully', {
        lessonId: id,
        folderName: downloadResult.fileName,
        fileCount: downloadResult.fileCount,
      userId: req.user?.user_id || null
      });
    } catch (error) {
      customLogger.error('Failed to download lesson folder', {
        error: error.message,
        lessonId: id,
      userId: req.user?.user_id || null
      });
      
      res.status(500).json({
        success: false,
        message: 'フォルダのダウンロードに失敗しました',
        error: error.message
      });
    } finally {
      connection.release();
    }
  };

  // レッスンファイル一覧取得
  const getLessonFiles = async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(`
        SELECT l.s3_key, l.title, c.title as course_title
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

      if (!lesson.s3_key) {
        return res.status(404).json({
          success: false,
          message: 'ファイルがアップロードされていません'
        });
      }

      // S3キーからフォルダプレフィックスを抽出
      const folderPrefix = lesson.s3_key.substring(0, lesson.s3_key.lastIndexOf('/'));
      
      // S3からフォルダ内のファイル一覧を取得
      const listResult = await s3Utils.listFiles(folderPrefix);

      if (!listResult.success) {
        return res.status(500).json({
          success: false,
          message: 'ファイル一覧の取得に失敗しました'
        });
      }

      // ファイル情報を整形
      const files = listResult.files.map(file => {
        const fileName = file.Key.split('/').pop();
        const fileSize = file.Size;
        const lastModified = file.LastModified;
        
        return {
          key: file.Key,
          name: fileName,
          size: fileSize,
          lastModified: lastModified,
          sizeFormatted: formatFileSize(fileSize)
        };
      });

      customLogger.info('Lesson files retrieved successfully', {
        lessonId: id,
        fileCount: files.length,
      userId: req.user?.user_id || null
      });

      res.json({
        success: true,
        data: {
          lesson: {
            id: id,
            title: lesson.title,
            courseTitle: lesson.course_title
          },
          files: files
        }
      });
    } catch (error) {
      customLogger.error('Failed to retrieve lesson files', {
        error: error.message,
        lessonId: id,
      userId: req.user?.user_id || null
      });
      
      res.status(500).json({
        success: false,
        message: 'ファイル一覧の取得に失敗しました',
        error: error.message
      });
    } finally {
      connection.release();
    }
  };

  // ファイルサイズをフォーマットする関数
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 個別ファイルダウンロード
  const downloadIndividualFile = async (req, res) => {
    try {
      const { fileKey } = req.body;

      if (!fileKey) {
        return res.status(400).json({
          success: false,
          message: 'ファイルキーが指定されていません'
        });
      }

      // S3からファイルをダウンロード
      const downloadResult = await s3Utils.downloadFile(fileKey);

      if (!downloadResult.success) {
        return res.status(404).json({
          success: false,
          message: downloadResult.message
        });
      }

      // ファイル名を抽出
      const fileName = fileKey.split('/').pop();

      // レスポンスヘッダー設定
      res.setHeader('Content-Type', downloadResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeRFC5987(fileName)}`);
      res.setHeader('Content-Length', downloadResult.data.length);

      res.send(downloadResult.data);

      customLogger.info('Individual file downloaded successfully', {
        fileKey: fileKey,
        fileName: fileName,
        userId: req.user?.id || null
      });
    } catch (error) {
      customLogger.error('Failed to download individual file', {
        error: error.message,
        fileKey: req.body.fileKey,
        userId: req.user?.id || null
      });
      
      res.status(500).json({
        success: false,
        message: 'ファイルのダウンロードに失敗しました',
        error: error.message
      });
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
  downloadLessonFolder,
  getLessonFiles,
  downloadIndividualFile,
  upload
}; 
