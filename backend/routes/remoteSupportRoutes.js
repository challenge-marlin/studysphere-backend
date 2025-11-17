const express = require('express');
const multer = require('multer');
const router = express.Router();
const RemoteSupportController = require('../scripts/remoteSupportController');

// multer設定（メモリ上でファイルを処理）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB制限
  }
});

// ヘルスチェックエンドポイント
router.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Remote Support API is running',
    timestamp: new Date().toISOString()
  });
});

// 画像アップロード（カメラ・スクリーンショット）
router.post('/upload-capture', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'screenshot', maxCount: 1 },
  { name: 'userToken', maxCount: 1 }
]), RemoteSupportController.uploadCapture);

// 勤怠打刻
router.post('/mark-attendance', RemoteSupportController.markAttendance);

// ログイン
router.post('/login', RemoteSupportController.login);

// 一時パスワード監視
router.get('/check-temp-password/:loginCode', RemoteSupportController.checkTempPassword);

// 自動ログイン
router.post('/auto-login', RemoteSupportController.autoLogin);

// 一時パスワード通知受信
router.post('/notify-temp-password', RemoteSupportController.notifyTempPassword);

// 一時パスワード通知取得
router.get('/get-temp-password-notification/:loginCode', RemoteSupportController.getTempPasswordNotification);

// スクールモード用：利用者コード検証
router.post('/verify-user-code', RemoteSupportController.verifyUserCode);

// 日報関連のエンドポイント
router.get('/daily-reports', RemoteSupportController.getDailyReports);
router.get('/daily-reports/:id', RemoteSupportController.getDailyReport);
router.put('/daily-reports/:id', RemoteSupportController.updateDailyReport);
router.delete('/daily-reports/:id', RemoteSupportController.deleteDailyReport);
router.post('/daily-reports/:id/comments', RemoteSupportController.addDailyReportComment);
router.delete('/daily-reports/:id/comments/:commentId', RemoteSupportController.deleteDailyReportComment);

// S3記録データ取得エンドポイント
router.get('/capture-records', RemoteSupportController.getCaptureRecords);
router.get('/capture-records/:userId/:date', RemoteSupportController.getCaptureRecordsByUserAndDate);

// 日次記録一覧取得（週次評価用）
router.get('/daily-records', require('../middleware/auth').authenticateToken, async (req, res) => {
  const { pool } = require('../utils/database');
  const { customLogger } = require('../utils/logger');
  const { convertUTCToJapanTime } = require('../utils/dateUtils');
  let connection;
  
  try {
    const { userId, startDate, endDate } = req.query;
    
    customLogger.info('日次記録取得リクエスト:', { 
      userId, 
      startDate, 
      endDate,
      userIdType: typeof userId,
      queryParams: req.query
    });
    
    // パラメータ検証
    if (!userId) {
      customLogger.warn('日次記録取得エラー: ユーザーIDが未指定');
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDは必須です'
      });
    }
    
    // userIdを整数に変換
    const userIdInt = parseInt(userId, 10);
    if (isNaN(userIdInt)) {
      customLogger.warn('日次記録取得エラー: ユーザーIDが無効', { userId });
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDが無効です'
      });
    }
    
    // 日付の検証（オプション）
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        customLogger.warn('日次記録取得エラー: 日付フォーマットが無効', { startDate, endDate });
        return res.status(400).json({
          success: false,
          message: '日付フォーマットが無効です'
        });
      }
      if (start > end) {
        customLogger.warn('日次記録取得エラー: 開始日が終了日より後', { startDate, endDate });
        return res.status(400).json({
          success: false,
          message: '開始日は終了日より前である必要があります'
        });
      }
    }
    
    // データベース接続を取得
    customLogger.info('データベース接続を取得中...');
    try {
      connection = await pool.getConnection();
      customLogger.info('データベース接続取得成功', { threadId: connection.threadId });
    } catch (connectionError) {
      customLogger.error('データベース接続取得失敗:', {
        error: connectionError.message,
        code: connectionError.code,
        errno: connectionError.errno,
        stack: connectionError.stack
      });
      throw new Error(`データベース接続に失敗しました: ${connectionError.message}`);
    }
    
    // conditionはMySQLの予約語なので、バッククォートでエスケープして別名を付ける
    // テンプレートリテラル内でバッククォートをエスケープするには、別の方法を使用
    const backtick = '`';
    let query = 'SELECT ' +
      'rsdr.id, ' +
      'rsdr.user_id, ' +
      'rsdr.date, ' +
      'rsdr.mark_start, ' +
      'rsdr.mark_lunch_start, ' +
      'rsdr.mark_lunch_end, ' +
      'rsdr.mark_end, ' +
      'rsdr.temperature, ' +
      'rsdr.' + backtick + 'condition' + backtick + ' as condition_original, ' +
      'rsdr.condition_note, ' +
      'rsdr.work_note, ' +
      'rsdr.work_result as workResult, ' +
      'rsdr.daily_report as dailyReport, ' +
      'rsdr.support_method as supportMethod, ' +
      'rsdr.support_method_note, ' +
      'rsdr.task_content as workContent, ' +
      'rsdr.support_content as supportContent, ' +
      'rsdr.advice, ' +
      'rsdr.instructor_comment, ' +
      'rsdr.recorder_name, ' +
      'rsdr.created_at, ' +
      'rsdr.updated_at ' +
      'FROM remote_support_daily_records rsdr ' +
      'WHERE rsdr.user_id = ?';
    
    const params = [userIdInt];
    
    if (startDate && endDate) {
      query += ' AND rsdr.date >= ? AND rsdr.date <= ?';
      params.push(startDate, endDate);
    }
    
    query += ' ORDER BY rsdr.date ASC';
    
    customLogger.info('SQL実行:', { 
      query: query.substring(0, 200) + '...', 
      params,
      paramsCount: params.length
    });
    
    const [rows] = await connection.execute(query, params);
    
    customLogger.info('日次記録取得件数:', { count: rows.length });
    
    // 時刻データを整理
    const records = rows.map(record => {
      // mark_startとmark_endから時間範囲を計算
      let startTime = '';
      let endTime = '';
      
      try {
        if (record.mark_start) {
          // UTCからJSTに変換
          const startUTC = new Date(record.mark_start);
          if (!isNaN(startUTC.getTime())) {
            const startJST = convertUTCToJapanTime(startUTC);
            startTime = `${String(startJST.getHours()).padStart(2, '0')}:${String(startJST.getMinutes()).padStart(2, '0')}`;
          }
        }
      } catch (e) {
        customLogger.warn('mark_startの解析エラー:', { mark_start: record.mark_start, error: e.message });
      }
      
      try {
        if (record.mark_end) {
          // UTCからJSTに変換
          const endUTC = new Date(record.mark_end);
          if (!isNaN(endUTC.getTime())) {
            const endJST = convertUTCToJapanTime(endUTC);
            endTime = `${String(endJST.getHours()).padStart(2, '0')}:${String(endJST.getMinutes()).padStart(2, '0')}`;
          }
        }
      } catch (e) {
        customLogger.warn('mark_endの解析エラー:', { mark_end: record.mark_end, error: e.message });
      }
      
      return {
        id: record.id,
        date: record.date,
        startTime: startTime,
        endTime: endTime,
        supportMethod: record.supportMethod || '未設定',
        workContent: record.workContent || '',
        workResult: record.workResult || '',
        dailyReport: record.dailyReport || '',
        supportContent: record.supportContent || '',
        advice: record.advice || '',
        condition: record.condition_original || '普通'
      };
    });
    
    customLogger.info('日次記録取得成功', { recordCount: records.length });
    
    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    customLogger.error('日次記録取得エラー:', {
      message: error.message,
      stack: error.stack,
      sql: error.sql,
      sqlMessage: error.sqlMessage,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      userId: req.query.userId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      requestUrl: req.url,
      requestMethod: req.method,
      requestHeaders: {
        authorization: req.headers.authorization ? 'Bearer ***' : 'none',
        contentType: req.headers['content-type']
      }
    });
    
    // SQLエラーの詳細を返す（開発・デバッグ用）
    const errorResponse = {
      success: false,
      message: '日次記録の取得に失敗しました',
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
      customLogger.error('データベース接続エラーが発生しました', {
        code: error.code,
        message: error.message
      });
    }
    
    res.status(500).json(errorResponse);
  } finally {
    // 接続を解放
    if (connection) {
      try {
        connection.release();
        customLogger.info('データベース接続を解放しました');
      } catch (releaseError) {
        customLogger.error('接続の解放に失敗:', {
          error: releaseError.message
        });
      }
    }
  }
});

// 在宅支援利用者の日次勤怠データ取得（拠点・日付指定）
router.get('/daily-attendance/:satelliteId', require('../middleware/auth').authenticateToken, async (req, res) => {
  const { pool } = require('../utils/database');
  const { customLogger } = require('../utils/logger');
  
  try {
    const { satelliteId } = req.params;
    const { date } = req.query;
    
    customLogger.info('日次勤怠取得リクエスト:', { satelliteId, date });
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: '日付は必須です'
      });
    }
    
    // 在宅支援利用者とその日の勤怠データ、通所記録を取得
    const query = `
      SELECT 
        ua.id as user_id,
        ua.name,
        ua.login_code,
        ua.recipient_number,
        rsdr.id as record_id,
        rsdr.date,
        rsdr.mark_start,
        rsdr.mark_lunch_start,
        rsdr.mark_lunch_end,
        rsdr.mark_end,
        CASE 
          WHEN ovr.id IS NOT NULL THEN '通所'
          WHEN rsdr.mark_start IS NOT NULL AND rsdr.mark_end IS NOT NULL THEN '作業中'
          WHEN rsdr.mark_start IS NOT NULL AND rsdr.mark_lunch_start IS NOT NULL AND rsdr.mark_lunch_end IS NULL THEN '休憩中'
          WHEN rsdr.mark_start IS NOT NULL THEN '作業中'
          ELSE '未開始'
        END as status
      FROM user_accounts ua
      LEFT JOIN remote_support_daily_records rsdr ON ua.id = rsdr.user_id AND rsdr.date = ?
      LEFT JOIN office_visit_records ovr ON ua.id = ovr.user_id AND ovr.visit_date = ?
      WHERE ua.role = 1 
        AND JSON_CONTAINS(ua.satellite_ids, ?)
        AND ua.status = 1
        AND ua.is_remote_user = 1
      ORDER BY ua.name
    `;
    
    const params = [date, date, JSON.stringify(parseInt(satelliteId))];
    
    customLogger.info('SQL実行:', { query, params });
    
    const [rows] = await pool.execute(query, params);
    
    customLogger.info('日次勤怠取得件数:', rows.length);
    
    // データを整形
    const attendanceRecords = rows.map(record => {
      // UTC時刻をISO文字列として返す（フロントエンドでJST変換）
      const formatTimeToISO = (datetime) => {
        if (!datetime) return null;
        try {
          // DATETIME文字列をUTCとして扱うために、ISO形式に変換
          const d = new Date(datetime);
          if (!isNaN(d.getTime())) {
            // UTC時刻としてISO文字列を返す
            return d.toISOString();
          }
        } catch (e) {
          customLogger.warn('時刻の解析エラー:', { datetime, error: e.message });
        }
        return null;
      };
      
      // 勤務時間を計算（分単位）- UTC時刻同士で計算
      const calculateWorkingMinutes = () => {
        if (!record.mark_start || !record.mark_end) return 0;
        
        try {
          const start = new Date(record.mark_start);
          const end = new Date(record.mark_end);
          
          if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
          
          // UTC時刻同士で計算
          let totalMinutes = (end - start) / (1000 * 60);
          
          // 昼食時間を差し引く
          if (record.mark_lunch_start && record.mark_lunch_end) {
            const lunchStart = new Date(record.mark_lunch_start);
            const lunchEnd = new Date(record.mark_lunch_end);
            
            if (!isNaN(lunchStart.getTime()) && !isNaN(lunchEnd.getTime())) {
              const lunchMinutes = (lunchEnd - lunchStart) / (1000 * 60);
              totalMinutes -= lunchMinutes;
            }
          }
          
          return Math.max(0, Math.round(totalMinutes));
        } catch (e) {
          customLogger.warn('勤務時間計算エラー:', { error: e.message });
          return 0;
        }
      };
      
      const workingMinutes = calculateWorkingMinutes();
      
      return {
        userId: record.user_id,
        name: record.name,
        recipientCertificateId: record.recipient_number || '-',
        recordId: record.record_id,
        date: record.date,
        // UTC時刻をISO文字列として返す（フロントエンドでJST変換）
        startTimeUTC: formatTimeToISO(record.mark_start),
        endTimeUTC: formatTimeToISO(record.mark_end),
        breakStartTimeUTC: formatTimeToISO(record.mark_lunch_start),
        breakEndTimeUTC: formatTimeToISO(record.mark_lunch_end),
        workingMinutes: workingMinutes,
        status: record.status
      };
    });
    
    res.json({
      success: true,
      data: attendanceRecords
    });
  } catch (error) {
    customLogger.error('日次勤怠取得エラー:', {
      message: error.message,
      stack: error.stack,
      query: error.sql
    });
    res.status(500).json({
      success: false,
      message: '日次勤怠の取得に失敗しました',
      error: error.message
    });
  }
});

// 勤怠データ更新
router.put('/daily-attendance/:recordId', require('../middleware/auth').authenticateToken, async (req, res) => {
  const { pool } = require('../utils/database');
  const { customLogger } = require('../utils/logger');
  
  try {
    const { recordId } = req.params;
    const { startTime, endTime, breakStartTime, breakEndTime, date } = req.body;
    
    customLogger.info('勤怠データ更新リクエスト:', { recordId, startTime, endTime, breakStartTime, breakEndTime, date });
    
    // JST時刻をUTC時刻に変換する関数
    const convertJSTToUTC = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return null;
      try {
        // JST時刻として解釈（Asia/Tokyoタイムゾーン）
        const jstDateTimeString = `${dateStr}T${timeStr}:00+09:00`;
        const jstDate = new Date(jstDateTimeString);
        
        if (isNaN(jstDate.getTime())) {
          customLogger.warn('JST時刻の変換エラー:', { dateStr, timeStr });
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
        customLogger.warn('JST→UTC変換エラー:', { dateStr, timeStr, error: e.message });
        return null;
      }
    };
    
    // recordIdがある場合は更新、ない場合は新規作成
    if (recordId && recordId !== 'null' && recordId !== 'undefined' && recordId !== 'new') {
      // 既存レコードの更新
      const updateQuery = `
        UPDATE remote_support_daily_records
        SET mark_start = ?,
            mark_end = ?,
            mark_lunch_start = ?,
            mark_lunch_end = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      // JST時刻をUTC時刻に変換
      const markStart = startTime && date ? convertJSTToUTC(date, startTime) : null;
      const markEnd = endTime && date ? convertJSTToUTC(date, endTime) : null;
      const markLunchStart = breakStartTime && date ? convertJSTToUTC(date, breakStartTime) : null;
      const markLunchEnd = breakEndTime && date ? convertJSTToUTC(date, breakEndTime) : null;
      
      await pool.execute(updateQuery, [markStart, markEnd, markLunchStart, markLunchEnd, recordId]);
      
      customLogger.info('勤怠データ更新完了:', { recordId });
      
      res.json({
        success: true,
        message: '勤怠データを更新しました',
        data: { recordId }
      });
    } else {
      // 新規レコードの作成
      const { userId } = req.body;
      
      if (!userId || !date) {
        return res.status(400).json({
          success: false,
          message: 'ユーザーIDと日付は必須です'
        });
      }
      
      const insertQuery = `
        INSERT INTO remote_support_daily_records 
          (user_id, date, mark_start, mark_end, mark_lunch_start, mark_lunch_end, work_note, condition, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, '', '普通', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          mark_start = VALUES(mark_start),
          mark_end = VALUES(mark_end),
          mark_lunch_start = VALUES(mark_lunch_start),
          mark_lunch_end = VALUES(mark_lunch_end),
          updated_at = CURRENT_TIMESTAMP
      `;
      
      // JST時刻をUTC時刻に変換
      const markStart = startTime && date ? convertJSTToUTC(date, startTime) : null;
      const markEnd = endTime && date ? convertJSTToUTC(date, endTime) : null;
      const markLunchStart = breakStartTime && date ? convertJSTToUTC(date, breakStartTime) : null;
      const markLunchEnd = breakEndTime && date ? convertJSTToUTC(date, breakEndTime) : null;
      
      const [result] = await pool.execute(insertQuery, [userId, date, markStart, markEnd, markLunchStart, markLunchEnd]);
      
      customLogger.info('勤怠データ作成完了:', { userId, date, insertId: result.insertId });
      
      res.json({
        success: true,
        message: '勤怠データを作成しました',
        data: { recordId: result.insertId }
      });
    }
  } catch (error) {
    customLogger.error('勤怠データ更新エラー:', {
      message: error.message,
      stack: error.stack,
      query: error.sql
    });
    res.status(500).json({
      success: false,
      message: '勤怠データの更新に失敗しました',
      error: error.message
    });
  }
});

// 月次勤怠データ取得（ユーザーID・年月指定）
router.get('/monthly-attendance/:userId', require('../middleware/auth').authenticateToken, async (req, res) => {
  const { pool } = require('../utils/database');
  const { customLogger } = require('../utils/logger');
  
  try {
    const { userId } = req.params;
    const { year, month } = req.query;
    
    customLogger.info('月次勤怠取得リクエスト:', { userId, year, month });
    
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: '年と月は必須です'
      });
    }
    
    // 指定月の開始日と終了日を計算
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    // 指定月の全日付に対して勤怠データを取得（データがない日も含む）
    // まず、利用者の在宅支援記録と通所記録を取得
    const attendanceQuery = `
      SELECT 
        rsdr.date,
        rsdr.mark_start,
        rsdr.mark_lunch_start,
        rsdr.mark_lunch_end,
        rsdr.mark_end
      FROM remote_support_daily_records rsdr
      WHERE rsdr.user_id = ?
        AND rsdr.date >= ?
        AND rsdr.date <= ?
      ORDER BY rsdr.date ASC
    `;
    
    const officeVisitQuery = `
      SELECT 
        ovr.visit_date as date
      FROM office_visit_records ovr
      WHERE ovr.user_id = ?
        AND ovr.visit_date >= ?
        AND ovr.visit_date <= ?
    `;
    
    const [attendanceRows] = await pool.execute(attendanceQuery, [userId, startDate, endDate]);
    const [officeVisitRows] = await pool.execute(officeVisitQuery, [userId, startDate, endDate]);
    
    customLogger.info('SQL実行:', { attendanceQuery, officeVisitQuery });
    
    customLogger.info('月次勤怠取得件数:', attendanceRows.length);
    customLogger.info('通所記録取得件数:', officeVisitRows.length);
    
    // データを日付をキーとしたマップに変換
    const attendanceMap = new Map();
    attendanceRows.forEach(record => {
      const dateStr = record.date.toISOString().split('T')[0];
      attendanceMap.set(dateStr, record);
    });
    
    // 通所記録を日付をキーとしたSetに変換
    const officeVisitSet = new Set();
    officeVisitRows.forEach(record => {
      const dateStr = record.date.toISOString().split('T')[0];
      officeVisitSet.add(dateStr);
    });
    
    // 指定月の全日付についてデータを生成
    const monthlyData = [];
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const date = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = date.getDay();
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      const record = attendanceMap.get(dateStr);
      const isOfficeVisit = officeVisitSet.has(dateStr);
      
      // UTC時刻をISO文字列として返す（フロントエンドでJST変換）
      const formatTimeToISO = (datetime) => {
        if (!datetime) return null;
        try {
          const d = new Date(datetime);
          if (!isNaN(d.getTime())) {
            // UTC時刻としてISO文字列を返す
            return d.toISOString();
          }
        } catch (e) {
          customLogger.warn('時刻の解析エラー:', { datetime, error: e.message });
        }
        return null;
      };
      
      // 勤務時間を計算（分単位）- UTC時刻同士で計算
      const calculateWorkingMinutes = () => {
        if (!record || !record.mark_start || !record.mark_end) return 0;
        
        try {
          const start = new Date(record.mark_start);
          const end = new Date(record.mark_end);
          
          if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
          
          // UTC時刻同士で計算
          let totalMinutes = (end - start) / (1000 * 60);
          
          // 昼食時間を差し引く
          if (record.mark_lunch_start && record.mark_lunch_end) {
            const lunchStart = new Date(record.mark_lunch_start);
            const lunchEnd = new Date(record.mark_lunch_end);
            
            if (!isNaN(lunchStart.getTime()) && !isNaN(lunchEnd.getTime())) {
              const lunchMinutes = (lunchEnd - lunchStart) / (1000 * 60);
              totalMinutes -= lunchMinutes;
            }
          }
          
          return Math.max(0, Math.round(totalMinutes));
        } catch (e) {
          customLogger.warn('勤務時間計算エラー:', { error: e.message });
          return 0;
        }
      };
      
      const workingMinutes = calculateWorkingMinutes();
      
      monthlyData.push({
        day: day,
        date: dateStr,
        dateDisplay: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
        dayOfWeek: dayNames[dayOfWeek],
        isWeekend: isWeekend,
        isOfficeVisit: isOfficeVisit,
        // UTC時刻をISO文字列として返す（フロントエンドでJST変換）
        startTimeUTC: record ? formatTimeToISO(record.mark_start) : null,
        endTimeUTC: record ? formatTimeToISO(record.mark_end) : null,
        breakStartTimeUTC: record ? formatTimeToISO(record.mark_lunch_start) : null,
        breakEndTimeUTC: record ? formatTimeToISO(record.mark_lunch_end) : null,
        workingMinutes: workingMinutes
      });
    }
    
    res.json({
      success: true,
      data: monthlyData
    });
  } catch (error) {
    customLogger.error('月次勤怠取得エラー:', {
      message: error.message,
      stack: error.stack,
      query: error.sql
    });
    res.status(500).json({
      success: false,
      message: '月次勤怠の取得に失敗しました',
      error: error.message
    });
  }
});

module.exports = router;