const { customLogger } = require('../utils/logger');
const { pool } = require('../utils/database');
const { recordOperationLogDirect } = require('./operationLogController');

// レッスン動画一覧取得
const getLessonVideos = async (req, res) => {
  const { lessonId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT lv.*, l.title as lesson_title
      FROM lesson_videos lv
      JOIN lessons l ON lv.lesson_id = l.id
      WHERE lv.lesson_id = ? AND l.status != 'deleted'
      ORDER BY lv.order_index ASC
    `, [lessonId]);

    customLogger.info('Lesson videos retrieved successfully', {
      lessonId: lessonId,
      count: rows.length,
      userId: req.user?.user_id || null
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('Failed to retrieve lesson videos', {
      error: error.message,
      lessonId: lessonId,
      userId: req.user?.user_id || null
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスン動画の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// レッスン動画詳細取得
const getLessonVideoById = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT lv.*, l.title as lesson_title
      FROM lesson_videos lv
      JOIN lessons l ON lv.lesson_id = l.id
      WHERE lv.id = ? AND l.status != 'deleted'
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'レッスン動画が見つかりません'
      });
    }

    customLogger.info('Lesson video retrieved successfully', {
      videoId: id,
      userId: req.user?.user_id || null
    });

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    customLogger.error('Failed to retrieve lesson video', {
      error: error.message,
      videoId: id,
      userId: req.user?.user_id || null
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスン動画の取得に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// レッスン動画作成
const createLessonVideo = async (req, res) => {
  const { lesson_id, title, description, youtube_url, order_index, duration } = req.body;
  const connection = await pool.getConnection();
  
  try {
    // レッスンの存在確認
    const [lessonRows] = await connection.execute(`
      SELECT id FROM lessons WHERE id = ? AND status != 'deleted'
    `, [lesson_id]);

    if (lessonRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '指定されたレッスンが見つかりません'
      });
    }

    // 動画作成
    const [result] = await connection.execute(`
      INSERT INTO lesson_videos (lesson_id, title, description, youtube_url, order_index, duration)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [lesson_id, title, description, youtube_url, order_index || 0, duration]);

    const videoId = result.insertId;

    // 作成された動画を取得
    const [rows] = await connection.execute(`
      SELECT * FROM lesson_videos WHERE id = ?
    `, [videoId]);

    // 操作ログ記録
    await recordOperationLogDirect({
      user_id: req.user.user_id,
      action: 'create',
      table_name: 'lesson_videos',
      record_id: videoId,
      details: `レッスン動画作成: ${title}`,
      ip_address: req.ip
    });

    customLogger.info('Lesson video created successfully', {
      videoId: videoId,
      lessonId: lesson_id,
      title: title,
      userId: req.user?.user_id || null
    });

    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'レッスン動画が正常に作成されました'
    });
  } catch (error) {
    customLogger.error('Failed to create lesson video', {
      error: error.message,
      lessonId: lesson_id,
      title: title,
      userId: req.user?.user_id || null
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスン動画の作成に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// レッスン動画更新
const updateLessonVideo = async (req, res) => {
  const { id } = req.params;
  const { title, description, youtube_url, order_index, duration } = req.body;
  const connection = await pool.getConnection();
  
  try {
    // 動画の存在確認
    const [existingRows] = await connection.execute(`
      SELECT * FROM lesson_videos WHERE id = ?
    `, [id]);

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'レッスン動画が見つかりません'
      });
    }

    // 動画更新
    await connection.execute(`
      UPDATE lesson_videos 
      SET title = ?, description = ?, youtube_url = ?, order_index = ?, duration = ?
      WHERE id = ?
    `, [title, description, youtube_url, order_index, duration, id]);

    // 更新された動画を取得
    const [rows] = await connection.execute(`
      SELECT * FROM lesson_videos WHERE id = ?
    `, [id]);

    // 操作ログ記録
    await recordOperationLogDirect({
      user_id: req.user.user_id,
      action: 'update',
      table_name: 'lesson_videos',
      record_id: id,
      details: `レッスン動画更新: ${title}`,
      ip_address: req.ip
    });

    customLogger.info('Lesson video updated successfully', {
      videoId: id,
      title: title,
      userId: req.user?.user_id || null
    });

    res.json({
      success: true,
      data: rows[0],
      message: 'レッスン動画が正常に更新されました'
    });
  } catch (error) {
    customLogger.error('Failed to update lesson video', {
      error: error.message,
      videoId: id,
      userId: req.user?.user_id || null
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスン動画の更新に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// レッスン動画削除
const deleteLessonVideo = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // 動画の存在確認
    const [existingRows] = await connection.execute(`
      SELECT * FROM lesson_videos WHERE id = ?
    `, [id]);

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'レッスン動画が見つかりません'
      });
    }

    // 動画削除
    await connection.execute(`
      DELETE FROM lesson_videos WHERE id = ?
    `, [id]);

    // 操作ログ記録
    await recordOperationLogDirect({
      user_id: req.user.user_id,
      action: 'delete',
      table_name: 'lesson_videos',
      record_id: id,
      details: `レッスン動画削除: ${existingRows[0].title}`,
      ip_address: req.ip
    });

    customLogger.info('Lesson video deleted successfully', {
      videoId: id,
      title: existingRows[0].title,
      userId: req.user?.user_id || null
    });

    res.json({
      success: true,
      message: 'レッスン動画が正常に削除されました'
    });
  } catch (error) {
    customLogger.error('Failed to delete lesson video', {
      error: error.message,
      videoId: id,
      userId: req.user?.user_id || null
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスン動画の削除に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// レッスン動画の順序更新
const updateLessonVideoOrder = async (req, res) => {
  const { videos } = req.body; // [{id: 1, order_index: 0}, {id: 2, order_index: 1}, ...]
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    for (const video of videos) {
      await connection.execute(`
        UPDATE lesson_videos SET order_index = ? WHERE id = ?
      `, [video.order_index, video.id]);
    }

    await connection.commit();

    // 操作ログ記録
    await recordOperationLogDirect({
      user_id: req.user.user_id,
      action: 'update',
      table_name: 'lesson_videos',
      record_id: null,
      details: `レッスン動画順序更新: ${videos.length}件`,
      ip_address: req.ip
    });

    customLogger.info('Lesson video order updated successfully', {
      videoCount: videos.length,
      userId: req.user?.user_id || null
    });

    res.json({
      success: true,
      message: 'レッスン動画の順序が正常に更新されました'
    });
  } catch (error) {
    await connection.rollback();
    
    customLogger.error('Failed to update lesson video order', {
      error: error.message,
      videoCount: videos?.length || 0,
      userId: req.user?.user_id || null
    });
    
    res.status(500).json({
      success: false,
      message: 'レッスン動画の順序更新に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// 複数動画を一括で作成・更新
const bulkUpsertLessonVideos = async (req, res) => {
  const { lesson_id, videos } = req.body;
  const connection = await pool.getConnection();
  
  try {
    // レッスンの存在確認
    const [lessonRows] = await connection.execute(`
      SELECT id, title FROM lessons WHERE id = ? AND status != 'deleted'
    `, [lesson_id]);

    if (lessonRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '指定されたレッスンが見つかりません'
      });
    }

    // トランザクション開始
    await connection.beginTransaction();

    // 既存の動画を削除（論理削除）
    await connection.execute(`
      UPDATE lesson_videos SET status = 'deleted' WHERE lesson_id = ?
    `, [lesson_id]);

    const createdVideos = [];
    
    // 新しい動画を一括挿入
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      
      // 必須フィールドの検証
      if (!video.title || !video.youtube_url) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `動画${i + 1}: タイトルとYouTube URLは必須です`
        });
      }

      // YouTube URLの基本的な検証
      if (!video.youtube_url.includes('youtube.com/watch?v=') && !video.youtube_url.includes('youtu.be/')) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `動画${i + 1}: 有効なYouTube URLではありません`
        });
      }

      const [result] = await connection.execute(`
        INSERT INTO lesson_videos (
          lesson_id, title, description, youtube_url, order_index, duration, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        lesson_id,
        video.title,
        video.description || null,
        video.youtube_url,
        video.order_index || i,
        video.duration || null,
        req.user?.user_id || null
      ]);

      createdVideos.push({
        id: result.insertId,
        ...video
      });
    }

    // トランザクションコミット
    await connection.commit();

    // 操作ログ記録
    try {
      await recordOperationLogDirect({
        userId: req.user?.user_id || null,
        action: 'bulk_upsert_lesson_videos',
        targetType: 'lesson',
        targetId: lesson_id,
        details: { 
          lessonTitle: lessonRows[0].title,
          videoCount: videos.length,
          videoTitles: videos.map(v => v.title)
        },
        ipAddress: req.ip
      });
    } catch (logError) {
      customLogger.warn('操作ログ記録に失敗しましたが、動画一括更新は続行します', {
        error: logError.message,
        lessonId: lesson_id,
        userId: req.user?.user_id || null
      });
    }

    customLogger.info('Lesson videos bulk upserted successfully', {
      lessonId: lesson_id,
      videoCount: videos.length,
      userId: req.user?.user_id || null
    });

    res.json({
      success: true,
      message: `${videos.length}個の動画が正常に更新されました`,
      data: createdVideos
    });
  } catch (error) {
    await connection.rollback();
    
    customLogger.error('Failed to bulk upsert lesson videos', {
      error: error.message,
      lessonId: lesson_id,
      userId: req.user?.user_id || null
    });
    
    res.status(500).json({
      success: false,
      message: '動画の一括更新に失敗しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getLessonVideos,
  getLessonVideoById,
  createLessonVideo,
  updateLessonVideo,
  deleteLessonVideo,
  updateLessonVideoOrder,
  bulkUpsertLessonVideos
};
