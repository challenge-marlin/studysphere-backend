const { customLogger } = require('../utils/logger');
const { executeQuery } = require('../utils/database');

// 操作ログを記録する
const recordOperationLog = async (req, res) => {
  try {
    const { adminId, adminName, action, details, ipAddress } = req.body;
    
    if (!adminId || !adminName || !action) {
      return res.status(400).json({
        success: false,
        message: '必須項目が不足しています'
      });
    }

    const query = `
      INSERT INTO operation_logs (admin_id, admin_name, action, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    
    const result = await executeQuery(query, [adminId, adminName, action, details, ipAddress]);
    if (!result.success) {
      throw new Error(result.error || '操作ログの記録に失敗しました');
    }
    
    customLogger.info('操作ログを記録', {
      adminId,
      adminName,
      action,
      details,
      ipAddress
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
    
    const offset = (page - 1) * limit;
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
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const logsResult = await executeQuery(query, [...params, parseInt(limit), offset]);
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
    const { days = 30 } = req.query;
    
    const query = `
      DELETE FROM operation_logs 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    
    const result = await executeQuery(query, [parseInt(days)]);
    if (!result.success) {
      throw new Error(result.error || '操作ログのクリアに失敗しました');
    }
    
    customLogger.info('操作ログをクリア', {
      deletedCount: result.affectedRows,
      days: parseInt(days),
      user: req.user?.id || 'anonymous'
    });
    
    res.json({
      success: true,
      message: `${result.data.affectedRows}件の操作ログを削除しました`,
      data: { deletedCount: result.data.affectedRows }
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

module.exports = {
  recordOperationLog,
  getOperationLogs,
  getOperationLogStats,
  exportOperationLogs,
  clearOperationLogs
}; 