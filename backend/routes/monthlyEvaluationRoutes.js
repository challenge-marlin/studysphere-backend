const express = require('express');
const router = express.Router();
const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { verifySatelliteAccess } = require('../utils/satelliteAuth');

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

/**
 * 日付文字列をMySQLのDATE型形式（YYYY-MM-DD）に変換
 * ISO形式（2025-11-28T00:00:00.000Z）やその他の形式からYYYY-MM-DD形式に変換
 * @param {string|Date|null} dateValue - 日付文字列またはDateオブジェクト
 * @returns {string|null} MySQLのDATE型形式（YYYY-MM-DD）またはnull
 */
const convertToMySQLDate = (dateValue) => {
  if (!dateValue) {
    return null;
  }
  
  try {
    let dateObj;
    
    if (dateValue instanceof Date) {
      dateObj = dateValue;
    } else if (typeof dateValue === 'string') {
      // 既にYYYY-MM-DD形式の場合はそのまま返す
      const ymdMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (ymdMatch) {
        return dateValue.substring(0, 10); // YYYY-MM-DD部分のみを返す
      }
      
      // ISO形式やその他の形式をDateオブジェクトに変換
      dateObj = new Date(dateValue);
    } else {
      customLogger.warn('convertToMySQLDate - 無効な型:', { dateValue, type: typeof dateValue });
      return null;
    }
    
    if (isNaN(dateObj.getTime())) {
      customLogger.warn('convertToMySQLDate - 無効な日付:', { dateValue });
      return null;
    }
    
    // YYYY-MM-DD形式に変換
    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    customLogger.warn('convertToMySQLDate - 変換エラー:', { dateValue, error: e.message });
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
router.post('/', authenticateToken, async (req, res) => {
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
    user_name,
    satellite_id
  } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 利用者が存在するかを確認
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDは必須です'
      });
    }
    
    // 利用者が存在し、指導員の所属拠点に所属しているかを確認
    if (req.user && req.user.user_id) {
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
      
      if (instructorRows.length > 0) {
        const instructor = instructorRows[0];
        
        // システム管理者（ロール9以上）の場合はスキップ
        if (instructor.role < 9) {
          // 拠点アクセス権限をチェック（ユーティリティを使用）
          const accessCheck = verifySatelliteAccess(instructor, targetUser, satellite_id);
          
          if (!accessCheck.hasAccess) {
            customLogger.warn('月報保存 - 拠点不一致:', {
              user_id,
              instructorId,
              selectedSatelliteId: satellite_id,
              reason: accessCheck.reason,
              commonSatellites: accessCheck.commonSatellites,
              targetUser_satellite_ids_raw: targetUser.satellite_ids,
              instructor_satellite_ids_raw: instructor.satellite_ids
            });
            return res.status(400).json({
              success: false,
              message: '利用者が指導員の所属拠点に所属していません',
              errorType: 'SATELLITE_ACCESS_DENIED',
              debug: {
                user_satellite_ids: accessCheck.receiverSatelliteIds || [],
                instructor_satellite_ids: accessCheck.senderSatelliteIds || [],
                selected_satellite_id: satellite_id
              }
            });
          }
          
          customLogger.info('月報保存 - 拠点認証成功:', {
            user_id,
            instructorId,
            commonSatellites: accessCheck.commonSatellites,
            reason: accessCheck.reason
          });
        }
      }
    }
    
    // evaluation_methodの値を検証して正規化（ENUM値に一致させる）
    // ENUM値の定義（データベースと完全一致させる）
    // 文字化け対策: 文字コードを明示的に確認
    const VALID_ENUM_VALUES = ['通所', '訪問', 'その他'];
    
    // 有効なENUM値の文字コードをログ出力（デバッグ用）
    const validEnumCharCodes = VALID_ENUM_VALUES.map(val => ({
      value: val,
      charCodes: Array.from(val).map(c => c.charCodeAt(0)),
      bytes: Buffer.from(val, 'utf8').toString('hex')
    }));
    customLogger.info('月次評価記録作成 - 有効なENUM値の文字コード:', validEnumCharCodes);
    
    let normalizedMethod = '通所'; // デフォルト値
    
    if (evaluation_method) {
      // 文字列に変換し、前後の空白を削除
      const trimmedMethod = String(evaluation_method).trim();
      
      // 受信した値の文字コードをログ出力
      const receivedCharCodes = Array.from(trimmedMethod).map(c => c.charCodeAt(0));
      const receivedBytes = Buffer.from(trimmedMethod, 'utf8').toString('hex');
      customLogger.info('月次評価記録作成 - 受信したevaluation_method:', {
        originalValue: evaluation_method,
        trimmedValue: trimmedMethod,
        type: typeof evaluation_method,
        charCodes: receivedCharCodes,
        bytes: receivedBytes,
        length: trimmedMethod.length
      });
      
      // ENUM値と完全一致するかチェック（文字コードレベルで比較）
      const matchedValue = VALID_ENUM_VALUES.find(enumValue => {
        const isExactMatch = trimmedMethod === enumValue;
        // 文字コードレベルでも確認
        const enumCharCodes = Array.from(enumValue).map(c => c.charCodeAt(0));
        const isCharCodeMatch = JSON.stringify(receivedCharCodes) === JSON.stringify(enumCharCodes);
        return isExactMatch || isCharCodeMatch;
      });
      
      if (matchedValue) {
        normalizedMethod = matchedValue;
        customLogger.info('月次評価記録作成 - ENUM値が一致しました:', {
          matchedValue,
          receivedValue: trimmedMethod
        });
      } else {
        // 部分一致や類似文字をチェック（念のため）
        const lowerTrimmed = trimmedMethod.toLowerCase();
        if (lowerTrimmed.includes('通所') || trimmedMethod.includes('通所')) {
          normalizedMethod = '通所';
          customLogger.warn('月次評価記録作成 - 部分一致で「通所」に設定:', { trimmedMethod });
        } else if (lowerTrimmed.includes('訪問') || trimmedMethod.includes('訪問')) {
          normalizedMethod = '訪問';
          customLogger.warn('月次評価記録作成 - 部分一致で「訪問」に設定:', { trimmedMethod });
        } else if (lowerTrimmed.includes('その他') || trimmedMethod.includes('その他')) {
          normalizedMethod = 'その他';
          customLogger.warn('月次評価記録作成 - 部分一致で「その他」に設定:', { trimmedMethod });
        } else {
          customLogger.warn('月次評価記録作成 - 無効なevaluation_method値:', {
            originalValue: evaluation_method,
            trimmedValue: trimmedMethod,
            type: typeof evaluation_method,
            charCodes: receivedCharCodes,
            bytes: receivedBytes,
            defaultValue: '通所'
          });
          normalizedMethod = '通所';
        }
      }
    }
    
    // 最終的な正規化値がENUM値と一致することを確認
    if (!VALID_ENUM_VALUES.includes(normalizedMethod)) {
      customLogger.error('月次評価記録作成 - 正規化後の値がENUM値と一致しません:', {
        normalizedMethod,
        normalizedCharCodes: Array.from(normalizedMethod).map(c => c.charCodeAt(0)),
        validValues: VALID_ENUM_VALUES
      });
      normalizedMethod = '通所'; // 強制的にデフォルト値を使用
    }
    
    // 最終的な正規化値の文字コードを確認
    const finalCharCodes = Array.from(normalizedMethod).map(c => c.charCodeAt(0));
    const finalBytes = Buffer.from(normalizedMethod, 'utf8').toString('hex');
    customLogger.info('月次評価記録作成 - 最終的なnormalizedMethod:', {
      normalizedValue: normalizedMethod,
      charCodes: finalCharCodes,
      bytes: finalBytes,
      isValid: VALID_ENUM_VALUES.includes(normalizedMethod)
    });
    
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
    
    // prev_evaluation_dateをMySQLのDATE型形式（YYYY-MM-DD）に変換
    const convertedPrevEvaluationDate = convertToMySQLDate(prev_evaluation_date);

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
      original_evaluation_method: evaluation_method,
      prev_evaluation_date_original: prev_evaluation_date,
      prev_evaluation_date_converted: convertedPrevEvaluationDate
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
      appropriateness, evaluator_name, convertedPrevEvaluationDate,
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
    customLogger.info('月次評価記録更新 - 受信した時間データ:', {
      id,
      mark_start_original: mark_start,
      mark_end_original: mark_end,
      mark_start_type: typeof mark_start,
      mark_end_type: typeof mark_end,
      mark_start_undefined: mark_start === undefined,
      mark_end_undefined: mark_end === undefined
    });
    
    const convertedMarkStart = mark_start !== undefined ? (mark_start ? convertJSTDateTimeToUTC(mark_start) : null) : undefined;
    const convertedMarkEnd = mark_end !== undefined ? (mark_end ? convertJSTDateTimeToUTC(mark_end) : null) : undefined;
    
    customLogger.info('月次評価記録更新 - 変換後の時間データ:', {
      id,
      convertedMarkStart,
      convertedMarkEnd,
      convertedMarkStart_undefined: convertedMarkStart === undefined,
      convertedMarkEnd_undefined: convertedMarkEnd === undefined
    });
    
    // prev_evaluation_dateをMySQLのDATE型形式（YYYY-MM-DD）に変換
    const convertedPrevEvaluationDate = prev_evaluation_date !== undefined ? convertToMySQLDate(prev_evaluation_date) : undefined;

    // evaluation_methodの値を検証して正規化（ENUM値に一致させる）
    const VALID_ENUM_VALUES = ['通所', '訪問', 'その他'];
    let normalizedEvaluationMethod = undefined;
    
    if (evaluation_method !== undefined) {
      normalizedEvaluationMethod = '通所'; // デフォルト値
      
      if (evaluation_method) {
        // 文字列に変換し、前後の空白を削除
        const trimmedMethod = String(evaluation_method).trim();
        
        // 受信した値の文字コードをログ出力
        const receivedCharCodes = Array.from(trimmedMethod).map(c => c.charCodeAt(0));
        const receivedBytes = Buffer.from(trimmedMethod, 'utf8').toString('hex');
        customLogger.info('月次評価記録更新 - 受信したevaluation_method:', {
          id,
          originalValue: evaluation_method,
          trimmedValue: trimmedMethod,
          type: typeof evaluation_method,
          charCodes: receivedCharCodes,
          bytes: receivedBytes,
          length: trimmedMethod.length
        });
        
        // ENUM値と完全一致するかチェック（文字コードレベルで比較）
        const matchedValue = VALID_ENUM_VALUES.find(enumValue => {
          const isExactMatch = trimmedMethod === enumValue;
          // 文字コードレベルでも確認
          const enumCharCodes = Array.from(enumValue).map(c => c.charCodeAt(0));
          const isCharCodeMatch = JSON.stringify(receivedCharCodes) === JSON.stringify(enumCharCodes);
          return isExactMatch || isCharCodeMatch;
        });
        
        if (matchedValue) {
          normalizedEvaluationMethod = matchedValue;
          customLogger.info('月次評価記録更新 - ENUM値が一致しました:', {
            id,
            matchedValue,
            receivedValue: trimmedMethod
          });
        } else {
          // 部分一致や類似文字をチェック（念のため）
          const lowerTrimmed = trimmedMethod.toLowerCase();
          if (lowerTrimmed.includes('通所') || trimmedMethod.includes('通所')) {
            normalizedEvaluationMethod = '通所';
            customLogger.warn('月次評価記録更新 - 部分一致で「通所」に設定:', { id, trimmedMethod });
          } else if (lowerTrimmed.includes('訪問') || trimmedMethod.includes('訪問')) {
            normalizedEvaluationMethod = '訪問';
            customLogger.warn('月次評価記録更新 - 部分一致で「訪問」に設定:', { id, trimmedMethod });
          } else if (lowerTrimmed.includes('その他') || trimmedMethod.includes('その他')) {
            normalizedEvaluationMethod = 'その他';
            customLogger.warn('月次評価記録更新 - 部分一致で「その他」に設定:', { id, trimmedMethod });
          } else {
            customLogger.warn('月次評価記録更新 - 無効なevaluation_method値:', {
              id,
              originalValue: evaluation_method,
              trimmedValue: trimmedMethod,
              type: typeof evaluation_method,
              charCodes: receivedCharCodes,
              bytes: receivedBytes,
              defaultValue: '通所'
            });
            normalizedEvaluationMethod = '通所';
          }
        }
      }
      
      // 最終的な正規化値がENUM値と一致することを確認
      if (!VALID_ENUM_VALUES.includes(normalizedEvaluationMethod)) {
        const finalCharCodes = Array.from(normalizedEvaluationMethod).map(c => c.charCodeAt(0));
        customLogger.error('月次評価記録更新 - 正規化後の値がENUM値と一致しません:', {
          id,
          normalizedMethod: normalizedEvaluationMethod,
          normalizedCharCodes: finalCharCodes,
          validValues: VALID_ENUM_VALUES
        });
        normalizedEvaluationMethod = '通所'; // 強制的にデフォルト値を使用
      } else {
        // 最終的な正規化値の文字コードを確認
        const finalCharCodes = Array.from(normalizedEvaluationMethod).map(c => c.charCodeAt(0));
        const finalBytes = Buffer.from(normalizedEvaluationMethod, 'utf8').toString('hex');
        customLogger.info('月次評価記録更新 - 最終的なnormalizedMethod:', {
          id,
          normalizedValue: normalizedEvaluationMethod,
          charCodes: finalCharCodes,
          bytes: finalBytes,
          isValid: VALID_ENUM_VALUES.includes(normalizedEvaluationMethod)
        });
      }
    }

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
    if (normalizedEvaluationMethod !== undefined) {
      updateFields.push('evaluation_method = ?');
      updateValues.push(normalizedEvaluationMethod);
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
    if (convertedPrevEvaluationDate !== undefined) {
      updateFields.push('prev_evaluation_date = ?');
      updateValues.push(convertedPrevEvaluationDate);
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
