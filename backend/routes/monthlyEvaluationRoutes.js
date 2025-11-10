const express = require('express');
const router = express.Router();
const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');

const formatDateToYmd = (dateObj) => {
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 日本時間の日付文字列を取得
 * 日本時間の日時オブジェクトから、日本時間の日付部分（YYYY-MM-DD）を取得
 * @param {Date} dateObj - Dateオブジェクト（UTC時刻として管理されているが、日本時間として解釈したい場合）
 * @returns {string} 日本時間の日付文字列（YYYY-MM-DD）
 */
const formatDateToYmdJST = (dateObj) => {
  // 日本時間のオフセット（+9時間）を考慮して、日本時間の日付を取得
  // UTC時刻に9時間を加算してから日付を取得
  const jstDate = new Date(dateObj.getTime() + (9 * 60 * 60 * 1000));
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 日本時間の日時文字列をUTC時刻のMySQL形式（YYYY-MM-DD HH:MM:SS）に変換
 * フロントエンドから送られる「YYYY-MM-DD HH:MM:SS」形式の文字列を、
 * 日本時間として解釈してUTC時刻に変換
 * @param {string} jstDateTimeString - 日本時間の日時文字列（YYYY-MM-DD HH:MM:SS）
 * @returns {string|null} UTC時刻のMySQL形式の日時文字列（YYYY-MM-DD HH:MM:SS）
 */
const convertJSTDateTimeToUTC = (jstDateTimeString) => {
  if (!jstDateTimeString || typeof jstDateTimeString !== 'string') {
    return null;
  }
  
  try {
    // 日本時間の日時文字列をISO形式に変換（+09:00を付与）
    // 「YYYY-MM-DD HH:MM:SS」形式を「YYYY-MM-DDTHH:MM:SS+09:00」形式に変換
    const isoString = jstDateTimeString.replace(' ', 'T') + '+09:00';
    const jstDate = new Date(isoString);
    
    if (isNaN(jstDate.getTime())) {
      customLogger.warn('JST時刻の変換エラー（無効な日時）:', { jstDateTimeString });
      return null;
    }
    
    // UTC時刻をMySQL形式（YYYY-MM-DD HH:MM:SS）に変換
    const utcYear = jstDate.getUTCFullYear();
    const utcMonth = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
    const utcDay = String(jstDate.getUTCDate()).padStart(2, '0');
    const utcHours = String(jstDate.getUTCHours()).padStart(2, '0');
    const utcMinutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
    const utcSeconds = String(jstDate.getUTCSeconds()).padStart(2, '0');
    
    return `${utcYear}-${utcMonth}-${utcDay} ${utcHours}:${utcMinutes}:${utcSeconds}`;
  } catch (e) {
    customLogger.warn('JST→UTC変換エラー:', { jstDateTimeString, error: e.message });
    return null;
  }
};

const computeDefaultPeriodFromEvaluationDate = (evaluationDate) => {
  if (!evaluationDate) {
    return { start: null, end: null };
  }

  // 評価日を日本時間として解釈
  // YYYY-MM-DD形式の文字列から、日本時間の年月を取得
  const evaluationDateStr = typeof evaluationDate === 'string' ? evaluationDate.trim() : String(evaluationDate);
  
  // 日付文字列の形式を検証（YYYY-MM-DD）
  const dateMatch = evaluationDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    // 日付文字列が正しくない場合は、Dateオブジェクトとして処理を試みる
    const baseDate = new Date(evaluationDate);
    if (Number.isNaN(baseDate.getTime())) {
      return { start: null, end: null };
    }
    // Dateオブジェクトから日本時間の日付文字列を取得
    const jstDateStr = formatDateToYmdJST(baseDate);
    const match = jstDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return { start: null, end: null };
    }
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    
    // 日本時間の月の最初の日と最後の日を計算
    const firstDayJST = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`);
    const lastDayJST = new Date(`${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00+09:00`);
    const lastDay = new Date(lastDayJST.getTime() - 24 * 60 * 60 * 1000); // 1日前
    
    return {
      start: formatDateToYmdJST(firstDayJST),
      end: formatDateToYmdJST(lastDay)
    };
  }
  
  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  
  // 日本時間の月の最初の日と最後の日を計算
  // 日本時間の月の最初の日のUTC時刻を作成
  const firstDayJST = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`);
  // 日本時間の月の最後の日のUTC時刻を作成（次の月の1日の前日）
  const lastDayJST = new Date(`${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00+09:00`);
  const lastDay = new Date(lastDayJST.getTime() - 24 * 60 * 60 * 1000); // 1日前
  
  return {
    start: formatDateToYmdJST(firstDayJST),
    end: formatDateToYmdJST(lastDay)
  };
};

const normalizePeriodRange = ({ periodStart, periodEnd, evaluationDate }) => {
  const trimmedStart = typeof periodStart === 'string' ? periodStart.trim() : periodStart;
  const trimmedEnd = typeof periodEnd === 'string' ? periodEnd.trim() : periodEnd;

  if (!trimmedStart && !trimmedEnd) {
    return computeDefaultPeriodFromEvaluationDate(evaluationDate);
  }

  if ((trimmedStart && !trimmedEnd) || (!trimmedStart && trimmedEnd)) {
    return { error: '対象期間の開始日と終了日は同時に指定してください。' };
  }

  // 日付文字列を日本時間（JST）として明示的に解釈
  // フロントエンドから送られる日付は日本時間として扱う必要がある
  // YYYY-MM-DD形式の文字列を、日本時間の午前0時として解釈
  const jstStartDateTimeString = `${trimmedStart}T00:00:00+09:00`;
  const jstEndDateTimeString = `${trimmedEnd}T00:00:00+09:00`;
  const startDate = new Date(jstStartDateTimeString);
  const endDate = new Date(jstEndDateTimeString);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: '対象期間の日付形式が正しくありません。' };
  }

  // 日本時間の日付を保持するため、日本時間の日付部分を取得
  const startDateStr = formatDateToYmdJST(startDate);
  const endDateStr = formatDateToYmdJST(endDate);
  
  // 日付文字列を直接比較（YYYY-MM-DD形式で比較）
  if (startDateStr > endDateStr) {
    return { error: '対象期間の開始日は終了日以前である必要があります。' };
  }

  return {
    start: startDateStr,
    end: endDateStr
  };
};

/**
 * 月次評価記録のCRUD操作
 */

// 月次評価記録一覧取得（特定ユーザー）
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { periodStart, periodEnd } = req.query;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    let query = `
      SELECT 
        mer.*,
        ua.name as user_name,
        ua.recipient_number
      FROM monthly_evaluation_records mer
      LEFT JOIN user_accounts ua ON mer.user_id = ua.id
      WHERE mer.user_id = ?
    `;
    
    const params = [userId];
    
    if (periodStart && periodEnd) {
      query += ` AND mer.date >= ? AND mer.date <= ?`;
      params.push(periodStart, periodEnd);
    }
    
    query += ` ORDER BY mer.date DESC`;
    
    const [rows] = await connection.execute(query, params);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('月次評価記録一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '月次評価記録の取得中にエラーが発生しました',
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

// 特定の月次評価記録取得
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        mer.*,
        ua.name as user_name,
        ua.recipient_number
      FROM monthly_evaluation_records mer
      LEFT JOIN user_accounts ua ON mer.user_id = ua.id
      WHERE mer.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '月次評価記録が見つかりません'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    customLogger.error('月次評価記録取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '月次評価記録の取得中にエラーが発生しました',
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

// 前回の月次評価記録取得（前回の達成度評価日用）
router.get('/user/:userId/latest', async (req, res) => {
  const { userId } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        id,
        date,
        period_start,
        period_end,
        created_at
      FROM monthly_evaluation_records
      WHERE user_id = ?
      ORDER BY date DESC
      LIMIT 1
    `, [userId]);
    
    res.json({
      success: true,
      data: rows.length > 0 ? rows[0] : null
    });
  } catch (error) {
    customLogger.error('前回月次評価記録取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '前回月次評価記録の取得中にエラーが発生しました',
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

// 月次評価記録作成
router.post('/', async (req, res) => {
  const {
    user_id,
    date,
    period_start,
    period_end,
    mark_start,
    mark_end,
    evaluation_method,
    method_other,
    goal,
    effort,
    achievement,
    issues,
    improvement,
    health,
    others,
    appropriateness,
    evaluator_name,
    prev_evaluation_date,
    recipient_number,
    user_name
  } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // evaluation_methodの値を検証して正規化（ENUM値に一致させる）
    let normalizedMethod = '通所'; // デフォルト値
    if (evaluation_method === '通所' || evaluation_method === '訪問' || evaluation_method === 'その他') {
      normalizedMethod = evaluation_method;
    } else {
      customLogger.warn(`無効なevaluation_method値: "${evaluation_method}" (型: ${typeof evaluation_method})。デフォルト値「通所」を使用します。`);
      normalizedMethod = '通所';
    }
    
    const normalizedPeriod = normalizePeriodRange({
      periodStart: period_start,
      periodEnd: period_end,
      evaluationDate: date
    });

    if (normalizedPeriod.error) {
      return res.status(400).json({
        success: false,
        message: normalizedPeriod.error
      });
    }

    // mark_startとmark_endを日本時間からUTCに変換
    const convertedMarkStart = mark_start ? convertJSTDateTimeToUTC(mark_start) : null;
    const convertedMarkEnd = mark_end ? convertJSTDateTimeToUTC(mark_end) : null;

    // デバッグログ：挿入される値を確認
    customLogger.info('月次評価記録作成 - 挿入データ:', {
      user_id,
      date,
      period_start: normalizedPeriod.start,
      period_end: normalizedPeriod.end,
      mark_start_original: mark_start,
      mark_start_converted: convertedMarkStart,
      mark_end_original: mark_end,
      mark_end_converted: convertedMarkEnd,
      evaluation_method: normalizedMethod,
      original_evaluation_method: evaluation_method
    });
    
    const [result] = await connection.execute(`
      INSERT INTO monthly_evaluation_records (
        user_id, date, period_start, period_end, mark_start, mark_end, evaluation_method, method_other,
        goal, effort, achievement, issues, improvement, health, others,
        appropriateness, evaluator_name, prev_evaluation_date,
        recipient_number, user_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user_id, date, normalizedPeriod.start, normalizedPeriod.end, convertedMarkStart, convertedMarkEnd, normalizedMethod, method_other,
      goal, effort, achievement, issues, improvement, health, others,
      appropriateness, evaluator_name, prev_evaluation_date,
      recipient_number, user_name
    ]);
    
    res.status(201).json({
      success: true,
      message: '月次評価記録が正常に作成されました',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    customLogger.error('月次評価記録作成エラー:', error);
    res.status(500).json({
      success: false,
      message: '月次評価記録の作成中にエラーが発生しました',
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

// 月次評価記録更新
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    date,
    period_start,
    period_end,
    mark_start,
    mark_end,
    evaluation_method,
    method_other,
    goal,
    effort,
    achievement,
    issues,
    improvement,
    health,
    others,
    appropriateness,
    evaluator_name,
    prev_evaluation_date,
    recipient_number,
    user_name
  } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [existingRows] = await connection.execute(`
      SELECT date, period_start, period_end
      FROM monthly_evaluation_records
      WHERE id = ?
    `, [id]);

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '月次評価記録が見つかりません'
      });
    }

    const existingRecord = existingRows[0];

    const normalizedPeriod = normalizePeriodRange({
      periodStart: period_start !== undefined ? period_start : existingRecord.period_start,
      periodEnd: period_end !== undefined ? period_end : existingRecord.period_end,
      evaluationDate: date || existingRecord.date
    });

    if (normalizedPeriod.error) {
      return res.status(400).json({
        success: false,
        message: normalizedPeriod.error
      });
    }

    // mark_startとmark_endを日本時間からUTCに変換
    const convertedMarkStart = mark_start !== undefined ? (mark_start ? convertJSTDateTimeToUTC(mark_start) : null) : undefined;
    const convertedMarkEnd = mark_end !== undefined ? (mark_end ? convertJSTDateTimeToUTC(mark_end) : null) : undefined;

    // 更新する項目を動的に構築
    const updateFields = [];
    const updateValues = [];
    
    if (date !== undefined) {
      updateFields.push('date = ?');
      updateValues.push(date);
    }
    if (normalizedPeriod.start !== undefined) {
      updateFields.push('period_start = ?');
      updateValues.push(normalizedPeriod.start);
    }
    if (normalizedPeriod.end !== undefined) {
      updateFields.push('period_end = ?');
      updateValues.push(normalizedPeriod.end);
    }
    if (convertedMarkStart !== undefined) {
      updateFields.push('mark_start = ?');
      updateValues.push(convertedMarkStart);
    }
    if (convertedMarkEnd !== undefined) {
      updateFields.push('mark_end = ?');
      updateValues.push(convertedMarkEnd);
    }
    if (evaluation_method !== undefined) {
      updateFields.push('evaluation_method = ?');
      updateValues.push(evaluation_method);
    }
    if (method_other !== undefined) {
      updateFields.push('method_other = ?');
      updateValues.push(method_other);
    }
    if (goal !== undefined) {
      updateFields.push('goal = ?');
      updateValues.push(goal);
    }
    if (effort !== undefined) {
      updateFields.push('effort = ?');
      updateValues.push(effort);
    }
    if (achievement !== undefined) {
      updateFields.push('achievement = ?');
      updateValues.push(achievement);
    }
    if (issues !== undefined) {
      updateFields.push('issues = ?');
      updateValues.push(issues);
    }
    if (improvement !== undefined) {
      updateFields.push('improvement = ?');
      updateValues.push(improvement);
    }
    if (health !== undefined) {
      updateFields.push('health = ?');
      updateValues.push(health);
    }
    if (others !== undefined) {
      updateFields.push('others = ?');
      updateValues.push(others);
    }
    if (appropriateness !== undefined) {
      updateFields.push('appropriateness = ?');
      updateValues.push(appropriateness);
    }
    if (evaluator_name !== undefined) {
      updateFields.push('evaluator_name = ?');
      updateValues.push(evaluator_name);
    }
    if (prev_evaluation_date !== undefined) {
      updateFields.push('prev_evaluation_date = ?');
      updateValues.push(prev_evaluation_date);
    }
    if (recipient_number !== undefined) {
      updateFields.push('recipient_number = ?');
      updateValues.push(recipient_number);
    }
    if (user_name !== undefined) {
      updateFields.push('user_name = ?');
      updateValues.push(user_name);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '更新する項目がありません'
      });
    }

    updateValues.push(id);

    const [result] = await connection.execute(`
      UPDATE monthly_evaluation_records SET
        ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);
    
    res.json({
      success: true,
      message: '月次評価記録が正常に更新されました'
    });
  } catch (error) {
    customLogger.error('月次評価記録更新エラー:', error);
    res.status(500).json({
      success: false,
      message: '月次評価記録の更新中にエラーが発生しました',
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

// 月次評価記録削除
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(`
      DELETE FROM monthly_evaluation_records WHERE id = ?
    `, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '月次評価記録が見つかりません'
      });
    }
    
    res.json({
      success: true,
      message: '月次評価記録が正常に削除されました'
    });
  } catch (error) {
    customLogger.error('月次評価記録削除エラー:', error);
    res.status(500).json({
      success: false,
      message: '月次評価記録の削除中にエラーが発生しました',
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
