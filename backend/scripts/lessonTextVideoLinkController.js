const { customLogger } = require('../utils/logger');
const { pool } = require('../utils/database');

// テキストと動画の紐づけ一覧取得
// レッスンIDに一致する紐づけを取得（動画が紐づいているもののみ表示）
// 動画のないテキストはリストに含めない（新しい紐づけは「新しい紐づけを追加」から作成可能）
const getTextVideoLinks = async (req, res) => {
  const { lessonId } = req.params;
  const connection = await pool.getConnection();
  
  try {
    // レッスンの存在確認
    const [lessons] = await connection.execute(
      'SELECT id FROM lessons WHERE id = ? AND status != "deleted"',
      [lessonId]
    );
    
    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'レッスンが見つかりません'
      });
    }

    // レッスン本体のテキスト（s3_key / file_type）を取得
    // lesson_text_video_links の text_file_key が「ファイル名のみ」で保存されているケースでも、
    // ここでフルS3キーへ正規化できるようにする（特にセクション0がレッスン本文を指す場合）
    const [lessonRows] = await connection.execute(
      'SELECT s3_key, file_type FROM lessons WHERE id = ?',
      [lessonId]
    );
    const lessonMainS3Key = lessonRows?.[0]?.s3_key || null;
    const lessonMainFileType = lessonRows?.[0]?.file_type || null;
    
    // レッスンIDに一致するすべての紐づけを取得
    const query = `
      SELECT 
        ltv.id,
        ltv.lesson_id,
        ltv.text_file_key,
        ltv.video_id,
        ltv.link_order,
        ltv.created_at,
        ltv.updated_at,
        lv.title as video_title,
        lv.youtube_url,
        lv.description as video_description,
        lv.duration as video_duration,
        lv.thumbnail_url
      FROM lesson_text_video_links ltv
      LEFT JOIN lesson_videos lv ON ltv.video_id = lv.id
      WHERE ltv.lesson_id = ?
      ORDER BY ltv.link_order ASC, ltv.created_at ASC
    `;
    
    const [links] = await connection.execute(query, [lessonId]);
    
    // lesson_text_filesから完全パスとfile_typeを取得してマージ
    const processedLinks = await Promise.all(links.map(async (link) => {
      // lesson_text_filesから該当するファイルを検索（ファイル名で比較）
      const extractFileName = (key) => {
        if (!key) return '';
        const parts = key.split('/');
        return parts[parts.length - 1].trim().toLowerCase();
      };
      
      const linkFileName = extractFileName(link.text_file_key);
      
      // lesson_text_filesから該当するファイルを検索
      const [matchingFiles] = await connection.execute(`
        SELECT s3_key, file_type
        FROM lesson_text_files
        WHERE lesson_id = ? 
          AND status = 'active'
          AND (
            LOWER(SUBSTRING_INDEX(s3_key, '/', -1)) = ?
            OR LOWER(file_name) = ?
          )
        LIMIT 1
      `, [lessonId, linkFileName, linkFileName]);
      
      let finalTextFileKey = link.text_file_key;
      let finalFileType = null;
      
      if (matchingFiles.length > 0) {
        // lesson_text_filesから完全パスとfile_typeを取得
        finalTextFileKey = matchingFiles[0].s3_key;
        finalFileType = matchingFiles[0].file_type;
        
        // file_typeがnullまたは短い形式の場合は正規化
        if (!finalFileType || finalFileType.toLowerCase() === 'md') {
          const lowerKey = finalTextFileKey.toLowerCase();
          if (lowerKey.endsWith('.md')) {
            finalFileType = 'text/markdown';
          } else if (lowerKey.endsWith('.txt')) {
            finalFileType = 'text/plain';
          } else if (lowerKey.endsWith('.pdf')) {
            finalFileType = 'application/pdf';
          } else if (lowerKey.endsWith('.rtf')) {
            finalFileType = 'application/rtf';
          } else {
            finalFileType = finalFileType || 'text/plain';
          }
        }
        
        customLogger.info('Found matching lesson_text_file for link', {
          lessonId: lessonId,
          linkTextFileKey: link.text_file_key,
          matchedS3Key: finalTextFileKey,
          originalFileType: matchingFiles[0].file_type,
          finalFileType: finalFileType
        });
      } else {
        // lesson_text_files に見つからない場合でも、レッスン本体の s3_key とファイル名が一致するなら、
        // フルS3キーへ正規化して返す（= フロントが確実に取得できるようにする）
        const mainFileName = extractFileName(lessonMainS3Key);
        if (lessonMainS3Key && mainFileName && mainFileName === linkFileName) {
          finalTextFileKey = lessonMainS3Key;
          // file_type は lessons.file_type を優先し、必要なら拡張子フォールバック
          let ft = lessonMainFileType;
          const lowerKey = String(finalTextFileKey).toLowerCase();
          if (!ft || String(ft).toLowerCase() === 'md') {
            if (lowerKey.endsWith('.md')) ft = 'text/markdown';
            else if (lowerKey.endsWith('.txt')) ft = 'text/plain';
            else if (lowerKey.endsWith('.pdf')) ft = 'application/pdf';
            else if (lowerKey.endsWith('.rtf')) ft = 'application/rtf';
            else ft = ft || 'text/plain';
          }
          finalFileType = ft;
          customLogger.info('Resolved link text_file_key using lesson main s3_key', {
            lessonId,
            linkTextFileKey: link.text_file_key,
            resolvedS3Key: finalTextFileKey,
            resolvedFileType: finalFileType
          });
        } else {
          // file_typeを拡張子から判定（最後のフォールバック）
          const lowerKey = String(link.text_file_key || '').toLowerCase();
          if (lowerKey.endsWith('.md')) {
            finalFileType = 'text/markdown';
          } else if (lowerKey.endsWith('.txt')) {
            finalFileType = 'text/plain';
          } else if (lowerKey.endsWith('.pdf')) {
            finalFileType = 'application/pdf';
          } else if (lowerKey.endsWith('.rtf')) {
            finalFileType = 'application/rtf';
          } else {
            finalFileType = 'text/plain';
          }
        }
      }
      
      return {
        ...link,
        text_file_key: finalTextFileKey, // 完全パスを使用
        file_type: finalFileType
      };
    }));
    
    // 動画が紐づいている紐づけのみを表示する（動画のないテキストは含めない）
    // 新しい紐づけは「新しい紐づけを追加」ボタンから作成可能
    const linkedSections = processedLinks
      .filter(link => link.video_id != null) // 動画が紐づいているもののみ
      .map(link => ({
        ...link,
        source: 'lesson_text_video_links'
      }));
    
    const allSections = linkedSections;
    
    // ソート: link_order、次にcreated_at
    allSections.sort((a, b) => {
      const orderA = a.link_order != null ? Number(a.link_order) : 999999;
      const orderB = b.link_order != null ? Number(b.link_order) : 999999;
      if (orderA !== orderB) return orderA - orderB;
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateA - dateB;
    });
    
    customLogger.info('Text video links retrieved successfully', {
      lessonId: lessonId,
      count: allSections.length,
      userId: req.user?.user_id || null
    });
    
    res.json({
      success: true,
      data: allSections
    });
  } catch (error) {
    customLogger.error('Failed to retrieve text video links', {
      error: error.message,
      lessonId: lessonId,
      userId: req.user?.user_id || null
    });
    
    res.status(500).json({
      success: false,
      message: 'テキストと動画の紐づけ取得中にエラーが発生しました',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// 特定の紐づけ取得
const getTextVideoLinkById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        ltv.id,
        ltv.lesson_id,
        ltv.text_file_key,
        ltv.video_id,
        ltv.link_order,
        ltv.created_at,
        ltv.updated_at,
        lv.title as video_title,
        lv.youtube_url,
        lv.description as video_description,
        lv.duration as video_duration,
        lv.thumbnail_url
      FROM lesson_text_video_links ltv
      LEFT JOIN lesson_videos lv ON ltv.video_id = lv.id
      WHERE ltv.id = ?
    `;
    
    const connection = await pool.getConnection();
    
    try {
      const [links] = await connection.execute(query, [id]);
      
      if (links.length === 0) {
        return res.status(404).json({
          success: false,
          message: '指定された紐づけが見つかりません'
        });
      }
      
      res.json({
        success: true,
        data: links[0]
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    customLogger.error('テキストと動画の紐づけ取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'テキストと動画の紐づけ取得中にエラーが発生しました'
    });
  }
};

// テキストと動画の紐づけ作成
const createTextVideoLink = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { lesson_id, text_file_key, video_id, link_order } = req.body;
    const userId = req.user?.user_id || req.user?.id;
    
    customLogger.info('Text video link creation request received', {
      lesson_id,
      text_file_key,
      video_id,
      link_order,
      userId
    });
    
    // バリデーション
    if (!lesson_id || !text_file_key || !video_id) {
      return res.status(400).json({
        success: false,
        message: '必須項目が不足しています'
      });
    }
    
    // レッスンと動画の存在確認
    const [lessons] = await connection.execute('SELECT id FROM lessons WHERE id = ?', [lesson_id]);
    const [videos] = await connection.execute('SELECT id FROM lesson_videos WHERE id = ?', [video_id]);
    
    if (lessons.length === 0) {
      return res.status(400).json({
        success: false,
        message: '指定されたレッスンが見つかりません'
      });
    }
    
    if (videos.length === 0) {
      return res.status(400).json({
        success: false,
        message: '指定された動画が見つかりません'
      });
    }
    
    // 重複チェック
    const [existing] = await connection.execute(
      'SELECT id FROM lesson_text_video_links WHERE lesson_id = ? AND text_file_key = ? AND video_id = ?',
      [lesson_id, text_file_key, video_id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'このテキストと動画の組み合わせは既に紐づけられています'
      });
    }
    
    // 順序の自動設定
    let finalOrder = link_order;
    if (finalOrder === undefined || finalOrder === null) {
      const [maxOrder] = await connection.execute(
        'SELECT COALESCE(MAX(link_order), -1) + 1 as next_order FROM lesson_text_video_links WHERE lesson_id = ?',
        [lesson_id]
      );
      finalOrder = maxOrder[0].next_order;
    }
    
    const query = `
      INSERT INTO lesson_text_video_links 
      (lesson_id, text_file_key, video_id, link_order, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await connection.execute(query, [
      lesson_id, 
      text_file_key, 
      video_id, 
      finalOrder, 
      userId, 
      userId
    ]);
    
    customLogger.info('Text video link created successfully', {
      linkId: result.insertId,
      lesson_id,
      text_file_key,
      video_id,
      link_order: finalOrder,
      userId
    });
    
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        lesson_id,
        text_file_key,
        video_id,
        link_order: finalOrder
      },
      message: 'テキストと動画の紐づけが作成されました'
    });
  } catch (error) {
    customLogger.error('テキストと動画の紐づけ作成エラー:', error);
    res.status(500).json({
      success: false,
      message: 'テキストと動画の紐づけ作成中にエラーが発生しました'
    });
  } finally {
    connection.release();
  }
};

// テキストと動画の紐づけ更新
const updateTextVideoLink = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { text_file_key, video_id, link_order } = req.body;
    const userId = req.user?.user_id || req.user?.id;
    
    // 既存の紐づけを確認
    const [existing] = await connection.execute(
      'SELECT * FROM lesson_text_video_links WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '指定された紐づけが見つかりません'
      });
    }
    
    const currentLink = existing[0];
    
    // 動画の存在確認（video_idが変更される場合）
    if (video_id && video_id !== currentLink.video_id) {
      const [videos] = await connection.execute('SELECT id FROM lesson_videos WHERE id = ?', [video_id]);
      if (videos.length === 0) {
        return res.status(400).json({
          success: false,
          message: '指定された動画が見つかりません'
        });
      }
    }
    
    // 重複チェック（text_file_keyまたはvideo_idが変更される場合）
    if ((text_file_key && text_file_key !== currentLink.text_file_key) || 
        (video_id && video_id !== currentLink.video_id)) {
      const [duplicate] = await connection.execute(
        'SELECT id FROM lesson_text_video_links WHERE lesson_id = ? AND text_file_key = ? AND video_id = ? AND id != ?',
        [currentLink.lesson_id, text_file_key || currentLink.text_file_key, video_id || currentLink.video_id, id]
      );
      
      if (duplicate.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'このテキストと動画の組み合わせは既に紐づけられています'
        });
      }
    }
    
    const query = `
      UPDATE lesson_text_video_links 
      SET 
        text_file_key = COALESCE(?, text_file_key),
        video_id = COALESCE(?, video_id),
        link_order = COALESCE(?, link_order),
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await connection.execute(query, [
      text_file_key,
      video_id,
      link_order,
      userId,
      id
    ]);
    
    res.json({
      success: true,
      message: 'テキストと動画の紐づけが更新されました'
    });
  } catch (error) {
    customLogger.error('テキストと動画の紐づけ更新エラー:', error);
    res.status(500).json({
      success: false,
      message: 'テキストと動画の紐づけ更新中にエラーが発生しました'
    });
  } finally {
    connection.release();
  }
};

// テキストと動画の紐づけ削除
const deleteTextVideoLink = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    
    const [existing] = await connection.execute(
      'SELECT * FROM lesson_text_video_links WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '指定された紐づけが見つかりません'
      });
    }
    
    await connection.execute('DELETE FROM lesson_text_video_links WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'テキストと動画の紐づけが削除されました'
    });
  } catch (error) {
    customLogger.error('テキストと動画の紐づけ削除エラー:', error);
    res.status(500).json({
      success: false,
      message: 'テキストと動画の紐づけ削除中にエラーが発生しました'
    });
  } finally {
    connection.release();
  }
};

// テキストと動画の紐づけ順序更新
const updateTextVideoLinkOrder = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { links } = req.body;
    
    if (!Array.isArray(links)) {
      return res.status(400).json({
        success: false,
        message: '無効なデータ形式です'
      });
    }
    
    for (const link of links) {
      if (!link.id || link.link_order === undefined) {
        return res.status(400).json({
          success: false,
          message: '必須項目が不足しています'
        });
      }
      
      await connection.execute(
        'UPDATE lesson_text_video_links SET link_order = ? WHERE id = ?',
        [link.link_order, link.id]
      );
    }
    
    res.json({
      success: true,
      message: 'テキストと動画の紐づけ順序が更新されました'
    });
  } catch (error) {
    customLogger.error('テキストと動画の紐づけ順序更新エラー:', error);
    res.status(500).json({
      success: false,
      message: 'テキストと動画の紐づけ順序更新中にエラーが発生しました'
    });
  } finally {
    connection.release();
  }
};

// 複数紐づけの一括作成・更新
const bulkUpsertTextVideoLinks = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { lesson_id, links } = req.body;
    const userId = req.user?.user_id || req.user?.id;
    
    if (!lesson_id || !Array.isArray(links)) {
      return res.status(400).json({
        success: false,
        message: '必須項目が不足しています'
      });
    }
    
    // レッスンの存在確認
    const [lessons] = await connection.execute('SELECT id FROM lessons WHERE id = ?', [lesson_id]);
    if (lessons.length === 0) {
      return res.status(400).json({
        success: false,
        message: '指定されたレッスンが見つかりません'
      });
    }
    
    // 既存の紐づけを削除
    await connection.execute('DELETE FROM lesson_text_video_links WHERE lesson_id = ?', [lesson_id]);
    
    // 新しい紐づけを作成
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      
      if (!link.text_file_key || !link.video_id) {
        continue; // 必須項目が不足している場合はスキップ
      }
      
      // 動画の存在確認
      const [videos] = await connection.execute('SELECT id FROM lesson_videos WHERE id = ?', [link.video_id]);
      if (videos.length === 0) {
        continue; // 動画が存在しない場合はスキップ
      }
      
      await connection.execute(
        `INSERT INTO lesson_text_video_links 
         (lesson_id, text_file_key, video_id, link_order, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [lesson_id, link.text_file_key, link.video_id, i, userId, userId]
      );
    }
    
    res.json({
      success: true,
      message: 'テキストと動画の紐づけが一括更新されました'
    });
  } catch (error) {
    customLogger.error('テキストと動画の紐づけ一括更新エラー:', error);
    res.status(500).json({
      success: false,
      message: 'テキストと動画の紐づけ一括更新中にエラーが発生しました'
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getTextVideoLinks,
  getTextVideoLinkById,
  createTextVideoLink,
  updateTextVideoLink,
  deleteTextVideoLink,
  updateTextVideoLinkOrder,
  bulkUpsertTextVideoLinks,
};
