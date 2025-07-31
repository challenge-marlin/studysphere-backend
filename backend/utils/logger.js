const winston = require('winston');
const path = require('path');
const fs = require('fs');

// ログディレクトリの作成
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// カスタムログフォーマット
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
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
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// ログレベルの設定
const logLevel = process.env.LOG_LEVEL || 'info';

// Winstonロガーの設定
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'curriculum-portal-backend' },
  transports: [
    // エラーログファイル
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // 全ログファイル
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // デバッグログファイル（開発環境のみ）
    ...(process.env.NODE_ENV === 'development' ? [
      new winston.transports.File({
        filename: path.join(logDir, 'debug.log'),
        level: 'debug',
        maxsize: 5242880, // 5MB
        maxFiles: 3,
      })
    ] : []),
  ],
});

// コンソール出力（開発環境のみ）
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// ログローテーション設定
const logRotation = {
  // 日次ローテーション
  daily: {
    filename: path.join(logDir, 'daily-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d'
  },
  
  // 週次ローテーション
  weekly: {
    filename: path.join(logDir, 'weekly-%DATE%.log'),
    datePattern: 'YYYY-[W]WW',
    maxSize: '100m',
    maxFiles: '8w'
  }
};

// カスタムログメソッド
const customLogger = {
  // 基本ログメソッド
  error: (message, meta = {}) => {
    logger.error(message, meta);
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
  }
};

// ログファイルのクリーンアップ関数
const cleanupOldLogs = (daysToKeep = 30) => {
  try {
    const files = fs.readdirSync(logDir);
    const now = Date.now();
    const cutoff = now - (daysToKeep * 24 * 60 * 60 * 1000);
    
    files.forEach(file => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime.getTime() < cutoff) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted old log file: ${file}`);
      }
    });
  } catch (error) {
    logger.error('Error cleaning up old logs', { error: error.message });
  }
};

// 定期的なログクリーンアップ（週1回）
setInterval(cleanupOldLogs, 7 * 24 * 60 * 60 * 1000);

module.exports = {
  logger,
  customLogger,
  cleanupOldLogs,
  logDir
}; 