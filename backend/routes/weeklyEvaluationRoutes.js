const express = require('express');
const router = express.Router();
const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

/**
 * 週次評価記録のCRUD操作
 */

// 前回評価日取得（より具体的なパスを先に配置）
router.get('/user/:userId/last-evaluation-date', async (req, res) => {
  const { userId } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        MAX(created_at) as last_evaluation_date
      FROM weekly_evaluation_records
      WHERE user_id = ?
    `, [userId]);
    
    const lastEvaluationDate = rows[0]?.last_evaluation_date ? 
      new Date(rows[0].last_evaluation_date).toISOString().split('T')[0] : null;
    
    res.json({
      success: true,
      data: {
        last_evaluation_date: lastEvaluationDate
      }
    });
  } catch (error) {
    customLogger.error('前回評価日取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '前回評価日の取得中にエラーが発生しました',
      error: error.message
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
});

// 週次評価記録一覧取得（特定ユーザー）
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { periodStart, periodEnd } = req.query;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    let query = `
      SELECT 
        wer.*,
        ua.name as user_name
      FROM weekly_evaluation_records wer
      LEFT JOIN user_accounts ua ON wer.user_id = ua.id
      WHERE wer.user_id = ?
    `;
    
    const params = [userId];
    
    if (periodStart && periodEnd) {
      // 評価日が検索期間内にある、または週報の期間と検索期間が重なっている週報を取得
      // 条件：
      // 1. 評価日（date）が検索期間内にある
      // 2. または、週報の期間（period_start ～ period_end）と検索期間（periodStart ～ periodEnd）が重なっている
      query += ` AND (
        (wer.date >= ? AND wer.date <= ?)
        OR
        (wer.period_start <= ? AND wer.period_end >= ?)
      )`;
      params.push(periodStart, periodEnd, periodEnd, periodStart);
    }
    
    query += ` ORDER BY wer.created_at DESC`;
    
    const [rows] = await connection.execute(query, params);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('週次評価記録一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '週次評価記録の取得中にエラーが発生しました',
      error: error.message
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
});

// 特定の週次評価記録取得
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        wer.*,
        ua.name as user_name
      FROM weekly_evaluation_records wer
      LEFT JOIN user_accounts ua ON wer.user_id = ua.id
      WHERE wer.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '週次評価記録が見つかりません'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    customLogger.error('週次評価記録取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '週次評価記録の取得中にエラーが発生しました',
      error: error.message
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
});

// 週次評価記録作成
router.post('/', authenticateToken, async (req, res) => {
  const {
    user_id,
    date,
    prev_eval_date,
    period_start,
    period_end,
    evaluation_method,
    method_other,
    evaluation_content,
    recorder_name,
    confirm_name
  } = req.body;
  
  let connection;
  try {
    try {
      connection = await pool.getConnection();
      customLogger.info('週次評価記録作成 - データベース接続取得成功', { threadId: connection.threadId });
    } catch (connectionError) {
      customLogger.error('週次評価記録作成 - データベース接続取得失敗:', {
        error: connectionError.message,
        code: connectionError.code,
        errno: connectionError.errno,
        stack: connectionError.stack
      });
      throw new Error(`データベース接続に失敗しました: ${connectionError.message}`);
    }
    
    // evaluation_methodの値を検証して正規化（ENUM値に一致させる）
    // デバッグログ：受信した値を確認
    customLogger.info('週次評価記録作成 - evaluation_method受信値:', {
      originalValue: evaluation_method,
      type: typeof evaluation_method,
      length: evaluation_method ? evaluation_method.length : 0,
      charCodes: evaluation_method ? Array.from(evaluation_method).map(c => c.charCodeAt(0)) : null
    });
    
    let normalizedMethod = '通所'; // デフォルト値
    // 文字列の正規化（前後の空白を削除、全角・半角の統一）
    const trimmedMethod = evaluation_method ? String(evaluation_method).trim() : '';
    
    // ENUM値との比較（完全一致）
    if (trimmedMethod === '通所' || trimmedMethod === '訪問' || trimmedMethod === 'その他') {
      normalizedMethod = trimmedMethod;
    } else {
      customLogger.warn('週次評価記録作成 - 無効なevaluation_method値:', {
        originalValue: evaluation_method,
        trimmedValue: trimmedMethod,
        type: typeof evaluation_method,
        charCodes: Array.from(trimmedMethod).map(c => c.charCodeAt(0)),
        defaultValue: '通所'
      });
      normalizedMethod = '通所';
    }
    
    customLogger.info('週次評価記録作成 - normalizedMethod:', {
      normalizedValue: normalizedMethod,
      charCodes: Array.from(normalizedMethod).map(c => c.charCodeAt(0))
    });
    
    // 必須パラメータの検証
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDは必須です'
      });
    }
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: '評価日は必須です'
      });
    }
    
    if (!period_start || !period_end) {
      return res.status(400).json({
        success: false,
        message: '評価期間（開始日・終了日）は必須です'
      });
    }
    
    // 利用者が存在し、指導員の所属拠点に所属しているかを確認
    const [userRows] = await connection.execute(`
      SELECT ua.id, ua.satellite_ids, ua.name
      FROM user_accounts ua
      WHERE ua.id = ? AND ua.status = 1
    `, [user_id]);
    
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '利用者が見つかりません'
      });
    }
    
    const targetUser = userRows[0];
    
    // 指導員の所属拠点を取得
    const instructorId = req.user.user_id;
    const [instructorRows] = await connection.execute(`
      SELECT satellite_ids, role
      FROM user_accounts
      WHERE id = ? AND status = 1
    `, [instructorId]);
    
    if (instructorRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '指導員情報が見つかりません'
      });
    }
    
    const instructor = instructorRows[0];
    
    // システム管理者（ロール9以上）の場合はスキップ
    if (instructor.role < 9) {
      // 利用者の所属拠点を取得
      let userSatelliteIds = [];
      if (targetUser.satellite_ids) {
        try {
          const parsed = JSON.parse(targetUser.satellite_ids);
          userSatelliteIds = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          customLogger.warn('利用者の拠点IDパースエラー:', { user_id, error: error.message });
        }
      }
      
      // 指導員の所属拠点を取得
      let instructorSatelliteIds = [];
      if (instructor.satellite_ids) {
        try {
          const parsed = JSON.parse(instructor.satellite_ids);
          instructorSatelliteIds = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          customLogger.warn('指導員の拠点IDパースエラー:', { instructorId, error: error.message });
        }
      }
      
      // 共通の拠点があるか確認
      const hasCommonSatellite = userSatelliteIds.some(userSatId => 
        instructorSatelliteIds.some(instSatId => 
          parseInt(userSatId) === parseInt(instSatId)
        )
      );
      
      if (!hasCommonSatellite) {
        customLogger.warn('週報保存 - 拠点不一致:', {
          user_id,
          userSatelliteIds,
          instructorId,
          instructorSatelliteIds
        });
        return res.status(403).json({
          success: false,
          message: '利用者が指導員の所属拠点に所属していません'
        });
      }
    }
    
    // SQL実行前のパラメータ型チェック
    // prev_eval_dateが空文字列、null、undefinedの場合はnullに変換
    let normalizedPrevEvalDate = null;
    if (prev_eval_date != null && prev_eval_date !== '') {
      const trimmed = String(prev_eval_date).trim();
      if (trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined') {
        // 日付形式の検証（YYYY-MM-DD形式を想定）
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (datePattern.test(trimmed)) {
          normalizedPrevEvalDate = trimmed;
        } else {
          // ISO形式やその他の形式を試す
          const dateObj = new Date(trimmed);
          if (!isNaN(dateObj.getTime())) {
            normalizedPrevEvalDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD形式に正規化
          }
        }
      }
    }
    
    customLogger.info('週次評価記録作成 - prev_eval_date正規化:', {
      original: prev_eval_date,
      normalized: normalizedPrevEvalDate,
      type: typeof prev_eval_date
    });
    
    // デバッグログ：挿入される値を確認
    customLogger.info('週次評価記録作成 - 挿入データ:', {
      user_id,
      date,
      prev_eval_date: normalizedPrevEvalDate,
      original_prev_eval_date: prev_eval_date,
      period_start,
      period_end,
      evaluation_method: normalizedMethod,
      original_evaluation_method: evaluation_method,
      method_other,
      has_content: !!evaluation_content,
      recorder_name,
      confirm_name
    });
    
    const insertParams = [
      parseInt(user_id, 10), // user_idを整数に変換
      date,
      normalizedPrevEvalDate,
      period_start,
      period_end,
      normalizedMethod,
      method_other || null,
      evaluation_content || null,
      recorder_name || null,
      confirm_name || null
    ];
    
    if (isNaN(insertParams[0])) {
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDが無効です'
      });
    }
    
    customLogger.info('週次評価記録作成 - SQL実行前:', {
      params: insertParams.map((p, i) => ({ index: i, value: p, type: typeof p }))
    });
    
    const [result] = await connection.execute(`
      INSERT INTO weekly_evaluation_records (
        user_id, date, prev_eval_date, period_start, period_end,
        evaluation_method, method_other, evaluation_content,
        recorder_name, confirm_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, insertParams);
    
    customLogger.info('週次評価記録作成成功:', { insertId: result.insertId });
    
    res.status(201).json({
      success: true,
      message: '週次評価記録が正常に作成されました',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    customLogger.error('週次評価記録作成エラー:', {
      message: error.message,
      stack: error.stack,
      sql: error.sql,
      sqlMessage: error.sqlMessage,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      requestBody: req.body,
      requestHeaders: {
        authorization: req.headers.authorization ? 'Bearer ***' : 'none',
        contentType: req.headers['content-type']
      }
    });
    
    // SQLエラーの詳細を返す（開発・デバッグ用）
    const errorResponse = {
      success: false,
      message: '週次評価記録の作成中にエラーが発生しました',
      error: error.message
    };
    
    // SQLエラーがある場合は追加情報を返す
    if (error.sqlMessage) {
      errorResponse.sqlError = error.sqlMessage;
      errorResponse.sqlCode = error.code;
    }
    
    // データベース接続エラーの場合
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('接続')) {
      errorResponse.errorType = 'DATABASE_CONNECTION_ERROR';
      customLogger.error('週次評価記録作成 - データベース接続エラーが発生しました', {
        code: error.code,
        message: error.message
      });
    }
    
    res.status(500).json(errorResponse);
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        customLogger.error('接続の解放に失敗:', {
          error: releaseError.message
        });
      }
    }
  }
});

// 週次評価記録更新
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    date,
    prev_eval_date,
    period_start,
    period_end,
    evaluation_method,
    method_other,
    evaluation_content,
    recorder_name,
    confirm_name
  } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // evaluation_methodの値を検証して正規化（ENUM値に一致させる）
    let normalizedMethod = '通所'; // デフォルト値
    if (evaluation_method === '通所' || evaluation_method === '訪問' || evaluation_method === 'その他') {
      normalizedMethod = evaluation_method;
    } else {
      customLogger.warn('週次評価記録更新 - 無効なevaluation_method値:', {
        id,
        originalValue: evaluation_method,
        type: typeof evaluation_method,
        defaultValue: '通所'
      });
      normalizedMethod = '通所';
    }
    
    // prev_eval_dateの正規化（空文字列、null、undefinedの場合はnullに変換）
    let normalizedPrevEvalDate = null;
    if (prev_eval_date != null && prev_eval_date !== '') {
      const trimmed = String(prev_eval_date).trim();
      if (trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined') {
        // 日付形式の検証（YYYY-MM-DD形式を想定）
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (datePattern.test(trimmed)) {
          normalizedPrevEvalDate = trimmed;
        } else {
          // ISO形式やその他の形式を試す
          const dateObj = new Date(trimmed);
          if (!isNaN(dateObj.getTime())) {
            normalizedPrevEvalDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD形式に正規化
          }
        }
      }
    }
    
    customLogger.info('週次評価記録更新 - prev_eval_date正規化:', {
      id,
      original: prev_eval_date,
      normalized: normalizedPrevEvalDate,
      type: typeof prev_eval_date
    });
    
    // デバッグログ：更新される値を確認
    customLogger.info('週次評価記録更新 - 更新データ:', {
      id,
      date,
      prev_eval_date: normalizedPrevEvalDate,
      original_prev_eval_date: prev_eval_date,
      period_start,
      period_end,
      evaluation_method: normalizedMethod,
      original_evaluation_method: evaluation_method,
      method_other,
      has_content: !!evaluation_content
    });
    
    const [result] = await connection.execute(`
      UPDATE weekly_evaluation_records SET
        date = ?, prev_eval_date = ?, period_start = ?, period_end = ?,
        evaluation_method = ?, method_other = ?, evaluation_content = ?,
        recorder_name = ?, confirm_name = ?
      WHERE id = ?
    `, [
      date, normalizedPrevEvalDate, period_start, period_end,
      normalizedMethod, method_other, evaluation_content,
      recorder_name, confirm_name, id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '週次評価記録が見つかりません'
      });
    }
    
    customLogger.info('週次評価記録更新成功:', { id, affectedRows: result.affectedRows });
    
    res.json({
      success: true,
      message: '週次評価記録が正常に更新されました'
    });
  } catch (error) {
    customLogger.error('週次評価記録更新エラー:', {
      message: error.message,
      stack: error.stack,
      sql: error.sql,
      sqlMessage: error.sqlMessage,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      id,
      requestBody: {
        evaluation_method,
        original_evaluation_method: req.body.evaluation_method
      }
    });
    
    res.status(500).json({
      success: false,
      message: '週次評価記録の更新中にエラーが発生しました',
      error: error.message,
      sqlError: error.sqlMessage || null
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        customLogger.error('接続の解放に失敗:', {
          error: releaseError.message
        });
      }
    }
  }
});

// 週次評価記録削除
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(`
      DELETE FROM weekly_evaluation_records WHERE id = ?
    `, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '週次評価記録が見つかりません'
      });
    }
    
    res.json({
      success: true,
      message: '週次評価記録が正常に削除されました'
    });
  } catch (error) {
    customLogger.error('週次評価記録削除エラー:', error);
    res.status(500).json({
      success: false,
      message: '週次評価記録の削除中にエラーが発生しました',
      error: error.message
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
});

module.exports = router;