const fs = require('fs').promises;
const path = require('path');
const { customLogger } = require('../utils/logger');
const { getLogConfig } = require('../config/logging');

// ログファイルの一覧を取得
const getLogFiles = async (req, res) => {
  try {
    const logDir = path.join(__dirname, '../logs');
    const files = await fs.readdir(logDir);
    
    const logFiles = [];
    for (const file of files) {
      const filePath = path.join(logDir, file);
      const stats = await fs.stat(filePath);
      
      logFiles.push({
        name: file,
        size: stats.size,
        modified: stats.mtime,
        path: filePath
      });
    }
    
    // ファイルサイズでソート（新しい順）
    logFiles.sort((a, b) => b.modified - a.modified);
    
    customLogger.info('ログファイル一覧を取得', {
      count: logFiles.length,
      user: req.user?.id || 'anonymous'
    });
    
    res.json({
      success: true,
      data: logFiles
    });
  } catch (error) {
    customLogger.error('ログファイル一覧取得エラー', {
      error: error.message,
      user: req.user?.id || 'anonymous'
    });
    
    res.status(500).json({
      success: false,
      message: 'ログファイルの取得に失敗しました',
      error: error.message
    });
  }
};

// ログファイルの内容を取得
const getLogContent = async (req, res) => {
  try {
    const { filename } = req.params;
    const { lines = 100, level, search } = req.query;
    
    const logDir = path.join(__dirname, '../logs');
    const filePath = path.join(logDir, filename);
    
    // セキュリティチェック：ディレクトリトラバーサル攻撃を防ぐ
    if (!filePath.startsWith(logDir)) {
      return res.status(403).json({
        success: false,
        message: 'アクセスが拒否されました'
      });
    }
    
    // ファイルの存在確認
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'ログファイルが見つかりません'
      });
    }
    
    // ファイルの内容を読み取り
    const content = await fs.readFile(filePath, 'utf8');
    let lines_array = content.split('\n').filter(line => line.trim());
    
    // レベルフィルター
    if (level) {
      lines_array = lines_array.filter(line => 
        line.toLowerCase().includes(`[${level.toUpperCase()}]`)
      );
    }
    
    // 検索フィルター
    if (search) {
      lines_array = lines_array.filter(line => 
        line.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // 行数制限
    const startIndex = Math.max(0, lines_array.length - parseInt(lines));
    const result = lines_array.slice(startIndex);
    
    customLogger.info('ログファイル内容を取得', {
      filename,
      lines: result.length,
      user: req.user?.id || 'anonymous'
    });
    
    res.json({
      success: true,
      data: {
        filename,
        content: result,
        totalLines: lines_array.length,
        filteredLines: result.length
      }
    });
  } catch (error) {
    customLogger.error('ログファイル内容取得エラー', {
      filename: req.params.filename,
      error: error.message,
      user: req.user?.id || 'anonymous'
    });
    
    res.status(500).json({
      success: false,
      message: 'ログファイルの読み取りに失敗しました',
      error: error.message
    });
  }
};

// ログファイルをダウンロード
const downloadLogFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const logDir = path.join(__dirname, '../logs');
    const filePath = path.join(logDir, filename);
    
    // セキュリティチェック
    if (!filePath.startsWith(logDir)) {
      return res.status(403).json({
        success: false,
        message: 'アクセスが拒否されました'
      });
    }
    
    // ファイルの存在確認
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'ログファイルが見つかりません'
      });
    }
    
    customLogger.info('ログファイルをダウンロード', {
      filename,
      user: req.user?.id || 'anonymous'
    });
    
    res.download(filePath);
  } catch (error) {
    customLogger.error('ログファイルダウンロードエラー', {
      filename: req.params.filename,
      error: error.message,
      user: req.user?.id || 'anonymous'
    });
    
    res.status(500).json({
      success: false,
      message: 'ログファイルのダウンロードに失敗しました',
      error: error.message
    });
  }
};

// ログファイルを削除
const deleteLogFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const logDir = path.join(__dirname, '../logs');
    const filePath = path.join(logDir, filename);
    
    // セキュリティチェック
    if (!filePath.startsWith(logDir)) {
      return res.status(403).json({
        success: false,
        message: 'アクセスが拒否されました'
      });
    }
    
    // ファイルの存在確認
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'ログファイルが見つかりません'
      });
    }
    
    // ファイルを削除
    await fs.unlink(filePath);
    
    customLogger.info('ログファイルを削除', {
      filename,
      user: req.user?.id || 'anonymous'
    });
    
    res.json({
      success: true,
      message: 'ログファイルを削除しました'
    });
  } catch (error) {
    customLogger.error('ログファイル削除エラー', {
      filename: req.params.filename,
      error: error.message,
      user: req.user?.id || 'anonymous'
    });
    
    res.status(500).json({
      success: false,
      message: 'ログファイルの削除に失敗しました',
      error: error.message
    });
  }
};

// 古いログファイルをクリーンアップ
const cleanupOldLogs = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const logDir = path.join(__dirname, '../logs');
    const files = await fs.readdir(logDir);
    
    const cutoff = Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(logDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime.getTime() < cutoff) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }
    
    customLogger.info('古いログファイルをクリーンアップ', {
      deletedCount,
      days: parseInt(days),
      user: req.user?.id || 'anonymous'
    });
    
    res.json({
      success: true,
      message: `${deletedCount}個のログファイルを削除しました`,
      data: { deletedCount }
    });
  } catch (error) {
    customLogger.error('ログファイルクリーンアップエラー', {
      error: error.message,
      user: req.user?.id || 'anonymous'
    });
    
    res.status(500).json({
      success: false,
      message: 'ログファイルのクリーンアップに失敗しました',
      error: error.message
    });
  }
};

// ログ統計情報を取得
const getLogStats = async (req, res) => {
  try {
    const logDir = path.join(__dirname, '../logs');
    const files = await fs.readdir(logDir);
    
    let totalSize = 0;
    let fileCount = 0;
    const levelStats = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0
    };
    
    for (const file of files) {
      const filePath = path.join(logDir, file);
      const stats = await fs.stat(filePath);
      
      totalSize += stats.size;
      fileCount++;
    }
    
    // 最新のログファイルからレベル統計を取得
    const latestLog = path.join(logDir, 'combined.log');
    try {
      const content = await fs.readFile(latestLog, 'utf8');
      const lines = content.split('\n').slice(-1000); // 最新1000行
      
      lines.forEach(line => {
        if (line.includes('[ERROR]')) levelStats.error++;
        else if (line.includes('[WARN]')) levelStats.warn++;
        else if (line.includes('[INFO]')) levelStats.info++;
        else if (line.includes('[DEBUG]')) levelStats.debug++;
      });
    } catch (error) {
      // ログファイルが存在しない場合は無視
    }
    
    const stats = {
      totalFiles: fileCount,
      totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
      levelStats,
      logConfig: getLogConfig()
    };
    
    customLogger.info('ログ統計情報を取得', {
      user: req.user?.id || 'anonymous'
    });
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    customLogger.error('ログ統計情報取得エラー', {
      error: error.message,
      user: req.user?.id || 'anonymous'
    });
    
    res.status(500).json({
      success: false,
      message: 'ログ統計情報の取得に失敗しました',
      error: error.message
    });
  }
};

module.exports = {
  getLogFiles,
  getLogContent,
  downloadLogFile,
  deleteLogFile,
  cleanupOldLogs,
  getLogStats
}; 