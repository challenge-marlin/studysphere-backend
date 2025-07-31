// ログ設定
const logConfig = {
  // 環境別のログレベル設定
  levels: {
    development: 'debug',
    staging: 'info',
    production: 'warn'
  },
  
  // ログファイル設定
  files: {
    error: {
      filename: 'logs/error.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      level: 'error'
    },
    combined: {
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      level: 'info'
    },
    debug: {
      filename: 'logs/debug.log',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      level: 'debug'
    },
    access: {
      filename: 'logs/access.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      level: 'info'
    }
  },
  
  // ログローテーション設定
  rotation: {
    daily: {
      filename: 'logs/daily-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    },
    weekly: {
      filename: 'logs/weekly-%DATE%.log',
      datePattern: 'YYYY-[W]WW',
      maxSize: '100m',
      maxFiles: '8w'
    }
  },
  
  // ログフォーマット設定
  format: {
    timestamp: 'YYYY-MM-DD HH:mm:ss',
    timezone: 'Asia/Tokyo',
    console: {
      colors: true,
      timestamp: 'HH:mm:ss',
      timezone: 'Asia/Tokyo'
    }
  },
  
  // 機密情報フィルター設定
  sensitive: {
    headers: ['authorization', 'cookie', 'x-api-key'],
    body: ['password', 'token', 'secret'],
    query: ['token', 'key']
  },
  
  // パフォーマンス監視設定
  performance: {
    slowRequestThreshold: 1000, // 1秒
    memoryWarningThreshold: 500 * 1024 * 1024, // 500MB
    memoryLeakThreshold: 50 * 1024 * 1024 // 50MB
  },
  
  // データベースログ設定
  database: {
    enabled: true,
    slowQueryThreshold: 100, // 100ms
    logParams: process.env.NODE_ENV === 'development'
  },
  
  // 認証ログ設定
  auth: {
    enabled: true,
    logSuccess: true,
    logFailure: true,
    maskPasswords: true
  }
};

// 環境変数から設定を取得
const getLogLevel = () => {
  return process.env.LOG_LEVEL || logConfig.levels[process.env.NODE_ENV] || 'info';
};

const getLogConfig = () => {
  return {
    ...logConfig,
    level: getLogLevel(),
    environment: process.env.NODE_ENV || 'development'
  };
};

module.exports = {
  logConfig,
  getLogLevel,
  getLogConfig
}; 