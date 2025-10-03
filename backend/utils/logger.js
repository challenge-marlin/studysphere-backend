const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { formatJapanTime } = require('./dateUtils');

// 日付ベースのログディレクトリを作成
const getLogDir = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const logDir = path.join(__dirname, '../logs', String(year), month, day);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  return logDir;
};

// ログディレクトリの作成
const logDir = getLogDir();

// ログディレクトリの権限確認と修正
const ensureLogDirectoryPermissions = () => {
  try {
    const logsBaseDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsBaseDir)) {
      fs.mkdirSync(logsBaseDir, { recursive: true, mode: 0o755 });
    }
    
    // 現在のログディレクトリの権限を確認
    const currentLogDir = getLogDir();
    const stats = fs.statSync(currentLogDir);
    
    // 権限が不十分な場合は修正
    if ((stats.mode & 0o777) !== 0o755) {
      fs.chmodSync(currentLogDir, 0o755);
      console.log(`Log directory permissions updated: ${currentLogDir}`);
    }
  } catch (error) {
    console.error('Error ensuring log directory permissions:', error);
  }
};

// ログディレクトリの権限を確保
ensureLogDirectoryPermissions();

// カスタムログフォーマット
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // 日本時間に変換
    let jstTime;
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        // タイムスタンプが無効な場合は現在時刻を使用
        jstTime = new Date().toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/\//g, '-');
      } else {
        jstTime = date.toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/\//g, '-');
      }
    } catch (error) {
      // エラーが発生した場合は現在時刻を使用
      jstTime = new Date().toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\//g, '-');
    }
    
    // 統一されたログフォーマット
    const environment = process.env.NODE_ENV || 'development';
    const service = meta.service || 'studysphere-backend';
    
    let log = `${jstTime} [${level.toUpperCase()}] [${environment}] [${service}]: ${message}`;
    
    // メタデータの整形（機密情報を除外）
    if (Object.keys(meta).length > 0) {
      const safeMeta = { ...meta };
      // 機密情報を除外
      delete safeMeta.password;
      delete safeMeta.token;
      delete safeMeta.authorization;
      delete safeMeta.cookie;
      
      if (Object.keys(safeMeta).length > 0) {
        log += ` | ${JSON.stringify(safeMeta, null, 0)}`;
      }
    }
    
    return log;
  })
);

// コンソール用フォーマット（開発環境用）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // 日本時間に変換
    let jstTime;
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        // タイムスタンプが無効な場合は現在時刻を使用
        jstTime = new Date().toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } else {
        jstTime = date.toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      }
    } catch (error) {
      // エラーが発生した場合は現在時刻を使用
      jstTime = new Date().toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }
    
    let log = `${jstTime} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// ログレベルの設定（本番環境では適切なレベルを設定）
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const effectiveLogLevel = ['error', 'warn', 'info', 'debug'].includes(logLevel) ? logLevel : 'info';

console.log(`Logger initialized with level: ${effectiveLogLevel}`);

// Winstonロガーの設定
const logger = winston.createLogger({
  level: effectiveLogLevel,
  format: logFormat,
  defaultMeta: { service: 'curriculum-portal-backend' },
  transports: [
    // エラーログファイル
    new winston.transports.File({
      filename: path.join(getLogDir(), 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      handleExceptions: true,
      handleRejections: true,
    }),
    
    // 全ログファイル
    new winston.transports.File({
      filename: path.join(getLogDir(), 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      handleExceptions: true,
      handleRejections: true,
    }),
    
    // デバッグログファイル（開発環境のみ）
    ...(process.env.NODE_ENV === 'development' ? [
      new winston.transports.File({
        filename: path.join(getLogDir(), 'debug.log'),
        level: 'debug',
        maxsize: 5242880, // 5MB
        maxFiles: 3,
        handleExceptions: true,
        handleRejections: true,
      })
    ] : []),
    
    // 本番環境用の追加ログファイル
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: path.join(getLogDir(), 'production.log'),
        level: 'info',
        maxsize: 10485760, // 10MB
        maxFiles: 7,
        handleExceptions: true,
        handleRejections: true,
      })
    ] : []),
  ],
  // 例外処理の設定
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(getLogDir(), 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(getLogDir(), 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  ],
  // ログの即座フラッシュを有効化
  exitOnError: false,
});

// コンソール出力（開発環境のみ）
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// ログの即座フラッシュ機能
const flushLogs = () => {
  return new Promise((resolve) => {
    logger.on('finish', resolve);
    logger.end();
  });
};

// ログローテーション設定
const logRotation = {
  // 日次ローテーション
  daily: {
    filename: path.join(getLogDir(), 'daily-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d'
  },
  
  // 週次ローテーション
  weekly: {
    filename: path.join(getLogDir(), 'weekly-%DATE%.log'),
    datePattern: 'YYYY-[W]WW',
    maxSize: '100m',
    maxFiles: '8w'
  }
};

// カスタムログメソッド（即座フラッシュ対応）
const customLogger = {
  // 基本ログメソッド
  error: (message, meta = {}) => {
    logger.error(message, meta);
    // エラーログは即座にフラッシュ
    if (logger.transports.length > 0) {
      logger.transports.forEach(transport => {
        if (transport.log && typeof transport.log === 'function') {
          transport.log({ level: 'error', message, ...meta }, () => {});
        }
      });
    }
  },
  
  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },
  
  info: (message, meta = {}) => {
    logger.info(message, meta);
  },
  
  debug: (message, meta = {}) => {
    logger.debug(message, meta);
  },
  
  // リクエストログ
  request: (req, meta = {}) => {
    const requestInfo = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params,
      ...meta
    };
    
    logger.info('Incoming Request', requestInfo);
  },
  
  // レスポンスログ
  response: (req, res, responseTime, meta = {}) => {
    const responseInfo = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length'),
      ...meta
    };
    
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('Outgoing Response', responseInfo);
  },
  
  // データベースログ
  database: (operation, query, params, duration, meta = {}) => {
    const dbInfo = {
      operation,
      query,
      params,
      duration: `${duration}ms`,
      ...meta
    };
    
    logger.debug('Database Operation', dbInfo);
  },
  
  // 認証ログ
  auth: (action, userId, success, meta = {}) => {
    const authInfo = {
      action,
      userId,
      success,
      ip: meta.ip,
      userAgent: meta.userAgent,
      ...meta
    };
    
    const level = success ? 'info' : 'warn';
    logger[level]('Authentication Event', authInfo);
  },
  
  // パフォーマンスログ
  performance: (operation, duration, meta = {}) => {
    const perfInfo = {
      operation,
      duration: `${duration}ms`,
      ...meta
    };
    
    const level = duration > 1000 ? 'warn' : 'debug';
    logger[level]('Performance Event', perfInfo);
  },
  
  // システムログ
  system: (event, meta = {}) => {
    logger.info(`System Event: ${event}`, meta);
  },
  
  // メモリ使用量ログ
  memory: (stats, meta = {}) => {
    const memoryInfo = {
      rss: `${Math.round(stats.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(stats.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(stats.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(stats.external / 1024 / 1024)}MB`,
      ...meta
    };
    
    logger.debug('Memory Usage', memoryInfo);
  },
  
  // エラーログ（詳細）
  errorWithStack: (error, context = {}) => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      ...context
    };
    
    logger.error('Application Error', errorInfo);
    // エラーログは即座にフラッシュ
    if (logger.transports.length > 0) {
      logger.transports.forEach(transport => {
        if (transport.log && typeof transport.log === 'function') {
          transport.log({ level: 'error', message: 'Application Error', ...errorInfo }, () => {});
        }
      });
    }
  },
  
  // ログの即座フラッシュ
  flush: flushLogs,
  
  // ログレベルの確認
  getLevel: () => logger.level,
  
  // ログファイルの確認
  getLogFiles: () => {
    try {
      const currentLogDir = getLogDir();
      const files = fs.readdirSync(currentLogDir);
      return files.map(file => ({
        name: file,
        path: path.join(currentLogDir, file),
        size: fs.statSync(path.join(currentLogDir, file)).size
      }));
    } catch (error) {
      return [];
    }
  }
};

// ログファイルのクリーンアップ関数
const cleanupOldLogs = (daysToKeep = 30) => {
  try {
    const logsBaseDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsBaseDir)) {
      return;
    }
    
    const years = fs.readdirSync(logsBaseDir);
    const now = Date.now();
    const cutoff = now - (daysToKeep * 24 * 60 * 60 * 1000);
    
    years.forEach(year => {
      const yearPath = path.join(logsBaseDir, year);
      if (!fs.statSync(yearPath).isDirectory()) return;
      
      const months = fs.readdirSync(yearPath);
      months.forEach(month => {
        const monthPath = path.join(yearPath, month);
        if (!fs.statSync(monthPath).isDirectory()) return;
        
        const days = fs.readdirSync(monthPath);
        days.forEach(day => {
          const dayPath = path.join(monthPath, day);
          if (!fs.statSync(dayPath).isDirectory()) return;
          
          const stats = fs.statSync(dayPath);
          if (stats.mtime.getTime() < cutoff) {
            // ディレクトリ内のファイルを削除
            const files = fs.readdirSync(dayPath);
            files.forEach(file => {
              const filePath = path.join(dayPath, file);
              fs.unlinkSync(filePath);
            });
            // 空のディレクトリを削除
            fs.rmdirSync(dayPath);
            logger.info(`Deleted old log directory: ${year}/${month}/${day}`);
          }
        });
        
        // 空の月ディレクトリを削除
        try {
          if (fs.readdirSync(monthPath).length === 0) {
            fs.rmdirSync(monthPath);
          }
        } catch (e) {
          // ディレクトリが既に削除されている場合
        }
      });
      
      // 空の年ディレクトリを削除
      try {
        if (fs.readdirSync(yearPath).length === 0) {
          fs.rmdirSync(yearPath);
        }
      } catch (e) {
        // ディレクトリが既に削除されている場合
      }
    });
  } catch (error) {
    logger.error('Error cleaning up old logs', { error: error.message });
  }
};

// 定期的なログクリーンアップ（週1回）
setInterval(cleanupOldLogs, 7 * 24 * 60 * 60 * 1000);

// プロセス終了時のログフラッシュ
process.on('exit', () => {
  customLogger.info('Application shutting down, flushing logs...');
  flushLogs();
});

process.on('SIGINT', () => {
  customLogger.info('Received SIGINT, flushing logs...');
  flushLogs().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  customLogger.info('Received SIGTERM, flushing logs...');
  flushLogs().then(() => process.exit(0));
});

module.exports = {
  logger,
  customLogger,
  cleanupOldLogs,
  getLogDir,
  logDir,
  flushLogs
}; 