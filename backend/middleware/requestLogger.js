const { customLogger } = require('../utils/logger');

// リクエストログミドルウェア
const requestLogger = (req, res, next) => {
  // リクエスト開始時刻を記録
  req.startTime = Date.now();
  
  // リクエスト情報をログに記録
  customLogger.request(req, {
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || generateRequestId()
  });
  
  // レスポンス終了時の処理を設定
  res.on('finish', () => {
    const responseTime = Date.now() - req.startTime;
    
    // レスポンス情報をログに記録
    customLogger.response(req, res, responseTime, {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || generateRequestId()
    });
    
    // パフォーマンス監視
    if (responseTime > 1000) {
      customLogger.performance('Slow Request', responseTime, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode
      });
    }
  });
  
  // エラーハンドリング
  res.on('error', (error) => {
    customLogger.errorWithStack(error, {
      method: req.method,
      url: req.url,
      requestId: req.headers['x-request-id'] || generateRequestId()
    });
  });
  
  next();
};

// リクエストID生成関数
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 詳細ログミドルウェア（開発環境のみ）
const detailedLogger = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    // リクエストボディの詳細ログ
    if (req.body && Object.keys(req.body).length > 0) {
      customLogger.debug('Request Body', {
        method: req.method,
        url: req.url,
        body: req.body
      });
    }
    
    // クエリパラメータの詳細ログ
    if (req.query && Object.keys(req.query).length > 0) {
      customLogger.debug('Query Parameters', {
        method: req.method,
        url: req.url,
        query: req.query
      });
    }
    
    // ヘッダーの詳細ログ（機密情報を除く）
    const safeHeaders = { ...req.headers };
    delete safeHeaders.authorization;
    delete safeHeaders.cookie;
    
    customLogger.debug('Request Headers', {
      method: req.method,
      url: req.url,
      headers: safeHeaders
    });
  }
  
  next();
};

// エラーログミドルウェア
const errorLogger = (error, req, res, next) => {
  customLogger.errorWithStack(error, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.headers['x-request-id'] || generateRequestId(),
    stack: error.stack
  });
  
  next(error);
};

// 認証ログミドルウェア
const authLogger = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // 認証関連のエンドポイントの場合
    if (req.path.includes('/auth') || req.path.includes('/login')) {
      const success = res.statusCode >= 200 && res.statusCode < 300;
      const userId = req.body?.username || req.body?.email || 'unknown';
      
      customLogger.auth('login', userId, success, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// データベースログミドルウェア（本番環境用改善版）
const dbLogger = (req, res, next) => {
  // データベース操作の監視
  const originalQuery = req.app.locals.db?.query;
  
  if (originalQuery) {
    req.app.locals.db.query = function(sql, params, callback) {
      const startTime = Date.now();
      
      const wrappedCallback = function(error, results) {
        const duration = Date.now() - startTime;
        
        // 本番環境では重要なクエリのみログ出力
        const shouldLog = process.env.NODE_ENV === 'development' || 
                         duration > 1000 || // 1秒以上のクエリ
                         error || // エラーが発生したクエリ
                         sql.toLowerCase().includes('insert') || 
                         sql.toLowerCase().includes('update') || 
                         sql.toLowerCase().includes('delete');
        
        if (shouldLog) {
          customLogger.database('query', sql, params, duration, {
            error: error ? error.message : null,
            rowCount: results ? results.length : 0,
            environment: process.env.NODE_ENV || 'development'
          });
        }
        
        // エラーの場合は常にログ出力
        if (error) {
          customLogger.errorWithStack(error, {
            type: 'database_error',
            query: sql,
            params: params,
            duration: duration
          });
        }
        
        if (callback) {
          callback(error, results);
        }
      };
      
      return originalQuery.call(this, sql, params, wrappedCallback);
    };
  }
  
  next();
};

module.exports = {
  requestLogger,
  detailedLogger,
  errorLogger,
  authLogger,
  dbLogger
}; 