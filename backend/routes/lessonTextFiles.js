const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/database');
const { s3Utils } = require('../config/s3');
const { customLogger } = require('../utils/logger');

// ファイルアップロード設定
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('サポートされていないファイル形式です'), false);
    }
  }
});

// レッスンの複数テキストファイル一覧取得
router.get('/lesson/:lessonId', authenticateToken, async (req, res) => {
  const { lessonId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    const query = `
      SELECT 
        ltf.id,
        ltf.lesson_id,
        ltf.file_name,
        ltf.s3_key,
        ltf.file_type,
        ltf.file_size,
        ltf.order_index,
        ltf.created_at,
        ltf.updated_at,
        l.title as lesson_title,
        c.title as course_title
      FROM lesson_text_files ltf
      JOIN lessons l ON ltf.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      WHERE ltf.lesson_id = ? AND ltf.status = 'active'
      ORDER BY ltf.order_index ASC, ltf.created_at ASC
    `;
    
    const [files] = await connection.execute(query, [lessonId]);
    
    customLogger.info('Lesson text files retrieved successfully', {
      lessonId: lessonId,
      count: files.length,
      userId: req.user?.user_id || null
    });
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    customLogger.error('Failed to retrieve lesson text files', {
      error: error.message,
      lessonId: lessonId,
      userId: req.user?.user_id || null
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスンテキストファイルの取得中にエラーが発生しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// 複数テキストファイルアップロード
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { lessonId, order } = req.body;
    const file = req.file;
    const userId = req.user?.user_id || req.user?.id;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'ファイルが選択されていません'
      });
    }
    
    if (!lessonId) {
      return res.status(400).json({
        success: false,
        message: 'レッスンIDが指定されていません'
      });
    }
    
    // レッスンの存在確認
    const [lessons] = await connection.execute('SELECT id, title FROM lessons WHERE id = ?', [lessonId]);
    if (lessons.length === 0) {
      return res.status(400).json({
        success: false,
        message: '指定されたレッスンが見つかりません'
      });
    }
    
    const lesson = lessons[0];
    
    // ファイルタイプの判定
    const fileTypeMap = {
      'application/pdf': 'pdf',
      'text/plain': 'text/plain',
      'text/markdown': 'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
    };
    
    const fileType = fileTypeMap[file.mimetype] || 'unknown';
    const fileName = file.originalname;
    const fileSize = file.size;
    
    // S3にアップロード
    const uploadResult = await s3Utils.uploadFile(
      file, 
      lesson.title, 
      'additional-text', 
      fileName
    );
    
    const s3Key = uploadResult.key;
    
    // 順序の自動設定
    let finalOrder = parseInt(order) || 0;
    if (finalOrder === 0) {
      const [maxOrder] = await connection.execute(
        'SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM lesson_text_files WHERE lesson_id = ?',
        [lessonId]
      );
      finalOrder = maxOrder[0].next_order;
    }
    
    // データベースに保存
    const query = `
      INSERT INTO lesson_text_files 
      (lesson_id, file_name, s3_key, file_type, file_size, order_index, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await connection.execute(query, [
      lessonId,
      fileName,
      s3Key,
      fileType,
      fileSize,
      finalOrder,
      userId,
      userId
    ]);
    
    customLogger.info('Lesson text file uploaded successfully', {
      fileId: result.insertId,
      lessonId: lessonId,
      fileName: fileName,
      s3Key: s3Key,
      fileSize: fileSize,
      fileType: fileType,
      order: finalOrder,
      userId: userId
    });
    
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        lesson_id: lessonId,
        file_name: fileName,
        s3_key: s3Key,
        file_type: fileType,
        file_size: fileSize,
        order_index: finalOrder
      },
      message: 'テキストファイルがアップロードされました'
    });
  } catch (error) {
    customLogger.error('Lesson text file upload error:', error);
    res.status(500).json({
      success: false,
      message: 'テキストファイルのアップロード中にエラーが発生しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// 複数テキストファイル削除
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // 既存のファイル情報を取得
    const [existing] = await connection.execute(
      'SELECT * FROM lesson_text_files WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '指定されたファイルが見つかりません'
      });
    }
    
    const file = existing[0];
    
    // S3からファイルを削除
    try {
      await s3Utils.deleteFile(file.s3_key);
    } catch (s3Error) {
      customLogger.warn('S3 file deletion failed', {
        error: s3Error.message,
        s3Key: file.s3_key,
        fileId: id
      });
    }
    
    // データベースから削除
    await connection.execute('DELETE FROM lesson_text_files WHERE id = ?', [id]);
    
    customLogger.info('Lesson text file deleted successfully', {
      fileId: id,
      fileName: file.file_name,
      s3Key: file.s3_key,
      userId: req.user?.user_id || null
    });
    
    res.json({
      success: true,
      message: 'テキストファイルが削除されました'
    });
  } catch (error) {
    customLogger.error('Lesson text file deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'テキストファイルの削除中にエラーが発生しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// 複数テキストファイル順序更新
router.put('/:id/order', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { order_index } = req.body;
  const connection = await pool.getConnection();
  
  try {
    if (order_index === undefined || order_index === null) {
      return res.status(400).json({
        success: false,
        message: '順序が指定されていません'
      });
    }
    
    await connection.execute(
      'UPDATE lesson_text_files SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [order_index, id]
    );
    
    customLogger.info('Lesson text file order updated successfully', {
      fileId: id,
      orderIndex: order_index,
      userId: req.user?.user_id || null
    });
    
    res.json({
      success: true,
      message: 'ファイルの順序が更新されました'
    });
  } catch (error) {
    customLogger.error('Lesson text file order update error:', error);
    res.status(500).json({
      success: false,
      message: 'ファイルの順序更新中にエラーが発生しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// 複数テキストファイル一括順序更新
router.put('/lesson/:lessonId/order', authenticateToken, async (req, res) => {
  const { lessonId } = req.params;
  const { files } = req.body;
  const connection = await pool.getConnection();
  
  try {
    if (!Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        message: '無効なデータ形式です'
      });
    }
    
    for (const file of files) {
      if (!file.id || file.order_index === undefined) {
        return res.status(400).json({
          success: false,
          message: '必須項目が不足しています'
        });
      }
      
      await connection.execute(
        'UPDATE lesson_text_files SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND lesson_id = ?',
        [file.order_index, file.id, lessonId]
      );
    }
    
    customLogger.info('Lesson text files order updated successfully', {
      lessonId: lessonId,
      fileCount: files.length,
      userId: req.user?.user_id || null
    });
    
    res.json({
      success: true,
      message: 'ファイルの順序が一括更新されました'
    });
  } catch (error) {
    customLogger.error('Lesson text files order update error:', error);
    res.status(500).json({
      success: false,
      message: 'ファイルの順序一括更新中にエラーが発生しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

module.exports = router;
