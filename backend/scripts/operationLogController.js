const { customLogger } = require('../utils/logger');
const { executeQuery } = require('../utils/database');

// 操作ログを記録する（直接オブジェクトを受け取る版）
const recordOperationLogDirect = async (logData) => {
  try {
    const { userId, action, targetType, targetId, details, ipAddress: providedIp } = logData;
    
    if (!userId || !action) {
      customLogger.warn('操作ログ記録に必要な情報が不足しています', {
        userId,
        action,
        targetType,
        targetId
      });
      return { success: false, error: '必須項目が不足しています' };
    }

    // ユーザー情報を取得（user_accounts から）
    const userQuery = `SELECT id, name FROM user_accounts WHERE id = ?`;
    const userResult = await executeQuery(userQuery, [userId]);
    
    let adminId = userId;
    let adminName = 'Unknown User';
    
    if (userResult.success && userResult.data.length > 0) {
      adminName = userResult.data[0].name || 'Unknown User';
    }

    const query = `
      INSERT INTO operation_logs (admin_id, admin_name, action, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    
    const detailsStr = details ? JSON.stringify(details) : null;
    const ipAddress = providedIp || 'N/A';
    
    const result = await executeQuery(query, [adminId, adminName, action, detailsStr, ipAddress]);
    if (!result.success) {
      throw new Error(result.error || '操作ログの記録に失敗しました');
    }
    
    customLogger.info('操作ログを記録', {
      adminId,
      adminName,
      action,
      details: detailsStr,
      ipAddress
    });
    
    return { success: true, data: { id: result.data.insertId } };
  } catch (error) {
    customLogger.error('操作ログ記録エラー', {
      error: error.message,
      logData
    });
    
    return { success: false, error: error.message };
  }
};

// 操作ログを記録する
const recordOperationLog = async (req, res) => {
  try {
    const { adminId, adminName, action, details, ipAddress } = req.body || {};

    // 受信内容をデバッグ（最小限）
    customLogger.info('操作ログPOST受信', {
      hasAdminId: !!adminId,
      hasAdminName: !!adminName,
      hasAction: !!action
    });

    // action が空でも保存する（サーバ側で既定値を当てる）

    // 不足項目の補完（トークン情報があれば使用）
    const safeAdminId = adminId ?? req.user?.user_id ?? null;
    const safeAdminName = adminName ?? req.user?.username ?? 'Unknown User';
    const finalAction = (typeof action === 'string' && action.trim()) ? action.trim() : 'unknown_action';

    const query = `
      INSERT INTO operation_logs (admin_id, admin_name, action, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;

    // details は TEXT なので、オブジェクトが来た場合は文字列化
    const detailsString = typeof details === 'object' && details !== null
      ? JSON.stringify(details)
      : (details ?? null);

    // IP は未指定なら接続元IPを使用
    const safeIp = (ipAddress && ipAddress !== 'N/A') ? ipAddress : (req.ip || 'N/A');

    const result = await executeQuery(query, [safeAdminId, safeAdminName, finalAction, detailsString, safeIp]);
    if (!result.success) {
      throw new Error(result.error || '操作ログの記録に失敗しました');
    }
    
    customLogger.info('操作ログを記録', {
      adminId,
      adminName,
      action: finalAction,
      details: detailsString,
      ipAddress: safeIp
    });
    
    res.json({
      success: true,
      message: '操作ログを記録しました',
      data: { id: result.data.insertId }
    });
  } catch (error) {
    customLogger.error('操作ログ記録エラー', {
      error: error.message,
      user: req.user?.id || 'anonymous'
    });
    
    res.status(500).json({
      success: false,
      message: '操作ログの記録に失敗しました',
      error: error.message
    });
  }
};

// 操作ログを取得する
const getOperationLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      adminName,
      action,
      startDate,
      endDate,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    // 数値系・ソート系の安全化
    const safeLimit = Math.max(1, Math.min(1000, parseInt(limit, 10) || 100));
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeOffset = (safePage - 1) * safeLimit;

    const allowedSortBy = ['id', 'admin_id', 'admin_name', 'action', 'created_at'];
    const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = (String(sortOrder || 'DESC').toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
    let whereConditions = [];
    let params = [];
    
    // フィルター条件を構築
    if (adminName) {
      whereConditions.push('admin_name LIKE ?');
      params.push(`%${adminName}%`);
    }
    
    if (action) {
      whereConditions.push('action LIKE ?');
      params.push(`%${action}%`);
    }
    
    if (startDate) {
      whereConditions.push('created_at >= ?');
      params.push(`${startDate} 00:00:00`);
    }
    
    if (endDate) {
      whereConditions.push('created_at <= ?');
      params.push(`${endDate} 23:59:59`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // 総件数を取得
    const countQuery = `SELECT COUNT(*) as total FROM operation_logs ${whereClause}`;
    const countResult = await executeQuery(countQuery, params);
    if (!countResult.success) {
      throw new Error(countResult.error || '総件数の取得に失敗しました');
    }
    const total = countResult.data[0].total;
    
    // ログデータを取得
    const query = `
      SELECT 
        id,
        admin_id,
        admin_name,
        action,
        details,
        ip_address,
        created_at
      FROM operation_logs 
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;

    const logsResult = await executeQuery(query, params);
    if (!logsResult.success) {
      throw new Error(logsResult.error || 'ログデータの取得に失敗しました');
    }
    const logs = logsResult.data;
    
    customLogger.info('操作ログを取得', {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      user: req.user?.id || 'anonymous'
    });
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    customLogger.error('操作ログ取得エラー', {
      error: error.message,
      user: req.user?.id || 'anonymous'
    });
    
    res.status(500).json({
      success: false,
      message: '操作ログの取得に失敗しました',
      error: error.message
    });
  }
};

// 操作ログの統計情報を取得する
const getOperationLogStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (startDate) {
      whereConditions.push('created_at >= ?');
      params.push(`${startDate} 00:00:00`);
    }
    
    if (endDate) {
      whereConditions.push('created_at <= ?');
      params.push(`${endDate} 23:59:59`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // 総ログ数
    const totalQuery = `SELECT COUNT(*) as total FROM operation_logs ${whereClause}`;
    const totalResult = await executeQuery(totalQuery, params);
    if (!totalResult.success) {
      throw new Error(totalResult.error || '総ログ数の取得に失敗しました');
    }
    const totalLogs = totalResult.data[0].total;
    
    // 今日のログ数
    const todayQuery = `
      SELECT COUNT(*) as today FROM operation_logs 
      ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} 
      DATE(created_at) = CURDATE()
    `;
    const todayResult = await executeQuery(todayQuery, params);
    if (!todayResult.success) {
      throw new Error(todayResult.error || '今日のログ数の取得に失敗しました');
    }
    const todayLogs = todayResult.data[0].today;
    
    // 今週のログ数
    const thisWeekQuery = `
      SELECT COUNT(*) as thisWeek FROM operation_logs 
      ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} 
      YEARWEEK(created_at) = YEARWEEK(NOW())
    `;
    const thisWeekResult = await executeQuery(thisWeekQuery, params);
    if (!thisWeekResult.success) {
      throw new Error(thisWeekResult.error || '今週のログ数の取得に失敗しました');
    }
    const thisWeekLogs = thisWeekResult.data[0].thisWeek;
    
    // 今月のログ数
    const thisMonthQuery = `
      SELECT COUNT(*) as thisMonth FROM operation_logs 
      ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} 
      YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())
    `;
    const thisMonthResult = await executeQuery(thisMonthQuery, params);
    if (!thisMonthResult.success) {
      throw new Error(thisMonthResult.error || '今月のログ数の取得に失敗しました');
    }
    const thisMonthLogs = thisMonthResult.data[0].thisMonth;
    
    // 操作別統計
    const actionStatsQuery = `
      SELECT action, COUNT(*) as count 
      FROM operation_logs ${whereClause}
      GROUP BY action 
      ORDER BY count DESC 
      LIMIT 10
    `;
    const actionStatsResult = await executeQuery(actionStatsQuery, params);
    if (!actionStatsResult.success) {
      throw new Error(actionStatsResult.error || '操作別統計の取得に失敗しました');
    }
    const actionStats = actionStatsResult.data;
    
    // 管理者別統計
    const adminStatsQuery = `
      SELECT admin_name, COUNT(*) as count 
      FROM operation_logs ${whereClause}
      GROUP BY admin_name 
      ORDER BY count DESC 
      LIMIT 10
    `;
    const adminStatsResult = await executeQuery(adminStatsQuery, params);
    if (!adminStatsResult.success) {
      throw new Error(adminStatsResult.error || '管理者別統計の取得に失敗しました');
    }
    const adminStats = adminStatsResult.data;
    
    const stats = {
      totalLogs,
      todayLogs,
      thisWeekLogs,
      thisMonthLogs,
      actionStats,
      adminStats
    };
    
    customLogger.info('操作ログ統計を取得', {
      user: req.user?.id || 'anonymous'
    });
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    customLogger.error('操作ログ統計取得エラー', {
      error: error.message,
      user: req.user?.id || 'anonymous'
    });
    
    res.status(500).json({
      success: false,
      message: '操作ログ統計の取得に失敗しました',
      error: error.message
    });
  }
};

// 操作ログをエクスポートする（CSV形式）
const exportOperationLogs = async (req, res) => {
  try {
    const { adminName, action, startDate, endDate } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (adminName) {
      whereConditions.push('admin_name LIKE ?');
      params.push(`%${adminName}%`);
    }
    
    if (action) {
      whereConditions.push('action LIKE ?');
      params.push(`%${action}%`);
    }
    
    if (startDate) {
      whereConditions.push('created_at >= ?');
      params.push(`${startDate} 00:00:00`);
    }
    
    if (endDate) {
      whereConditions.push('created_at <= ?');
      params.push(`${endDate} 23:59:59`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const query = `
      SELECT 
        admin_name,
        action,
        details,
        ip_address,
        created_at
      FROM operation_logs 
      ${whereClause}
      ORDER BY created_at DESC
    `;
    
    const logsResult = await executeQuery(query, params);
    if (!logsResult.success) {
      throw new Error(logsResult.error || 'ログデータの取得に失敗しました');
    }
    const logs = logsResult.data;
    
    // CSVヘッダー
    const csvHeaders = ['管理者名', '操作', '詳細', 'IPアドレス', '日時'];
    const csvRows = [csvHeaders.join(',')];
    
    // CSVデータ行
    logs.forEach(log => {
      const row = [
        `"${log.admin_name}"`,
        `"${log.action}"`,
        `"${log.details || ''}"`,
        log.ip_address,
        `"${new Date(log.created_at).toLocaleString('ja-JP')}"`
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const filename = `operation_logs_${new Date().toISOString().split('T')[0]}.csv`;
    
    customLogger.info('操作ログをエクスポート', {
      count: logs.length,
      user: req.user?.id || 'anonymous'
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    customLogger.error('操作ログエクスポートエラー', {
      error: error.message,
      user: req.user?.id || 'anonymous'
    });
    
    res.status(500).json({
      success: false,
      message: '操作ログのエクスポートに失敗しました',
      error: error.message
    });
  }
};

// 操作ログをクリアする
const clearOperationLogs = async (req, res) => {
  try {
    const { clearAll = 'true' } = req.query;
    
    let query, params, message;
    
    if (clearAll === 'true') {
      // すべてのログを削除
      query = `DELETE FROM operation_logs`;
      params = [];
      message = 'すべての操作ログを削除しました';
    } else {
      // 指定日数以上古いログのみ削除（後方互換性のため）
      const { days = 30 } = req.query;
      query = `DELETE FROM operation_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`;
      params = [parseInt(days)];
      message = `${days}日以上古い操作ログを削除しました`;
    }
    
    const result = await executeQuery(query, params);
    if (!result.success) {
      throw new Error(result.error || '操作ログのクリアに失敗しました');
    }
    
    const deletedCount = result.data.affectedRows || 0;
    
    customLogger.info('操作ログをクリア', {
      deletedCount,
      clearAll: clearAll === 'true',
      user: req.user?.id || 'anonymous'
    });
    
    res.json({
      success: true,
      message: `${deletedCount}件の${message}`,
      data: { deletedCount }
    });
  } catch (error) {
    customLogger.error('操作ログクリアエラー', {
      error: error.message,
      user: req.user?.id || 'anonymous'
    });
    
    res.status(500).json({
      success: false,
      message: '操作ログのクリアに失敗しました',
      error: error.message
    });
  }
};

// 重複ログをクリーンアップする（同一ユーザー・同一アクション・同一タイトル・±2秒の重複）
const cleanupDuplicateOperationLogs = async (req, res) => {
  try {
    const { timeWindowSeconds = 2 } = req.query;
    const window = Math.max(1, parseInt(timeWindowSeconds, 10) || 2);

    // 重複候補を検出（最新1件を残し、前のものを削除）
    const selectQuery = `
      SELECT o1.id
      FROM operation_logs o1
      JOIN operation_logs o2
        ON o1.admin_id = o2.admin_id
       AND o1.action = o2.action
       AND ABS(TIMESTAMPDIFF(SECOND, o1.created_at, o2.created_at)) <= ?
       AND (
            -- details JSON文字列から title を比較（片方でも一致すれば重複と見なす簡易ルール）
            (JSON_EXTRACT(o1.details, '$.title') IS NOT NULL AND JSON_EXTRACT(o1.details, '$.title') = JSON_EXTRACT(o2.details, '$.title'))
            OR (o1.details = o2.details)
       )
       AND o1.id < o2.id  -- 先の（古い）方を削除対象
    `;

    const { executeQuery } = require('../utils/database');
    const duplicates = await executeQuery(selectQuery, [window]);
    if (!duplicates.success) {
      throw new Error(duplicates.error || '重複検出に失敗しました');
    }

    const ids = duplicates.data.map(r => r.id);
    let deletedCount = 0;
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      const deleteQuery = `DELETE FROM operation_logs WHERE id IN (${placeholders})`;
      const del = await executeQuery(deleteQuery, ids);
      if (!del.success) {
        throw new Error(del.error || '重複削除に失敗しました');
      }
      deletedCount = del.data.affectedRows || 0;
    }

    customLogger.info('重複操作ログのクリーンアップ', { deletedCount, windowSeconds: window });
    res.json({ success: true, message: `${deletedCount}件の重複ログを削除しました`, data: { deletedCount } });
  } catch (error) {
    customLogger.error('重複操作ログクリーンアップエラー', { error: error.message });
    res.status(500).json({ success: false, message: '重複ログのクリーンアップに失敗しました', error: error.message });
  }
};

module.exports = {
  recordOperationLogDirect,
  recordOperationLog,
  getOperationLogs,
  getOperationLogStats,
  exportOperationLogs,
  clearOperationLogs,
  cleanupDuplicateOperationLogs
}; 