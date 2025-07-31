const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');
const { customLogger } = require('./logger');

// MySQL接続プールの作成
const pool = mysql.createPool({
  ...dbConfig,
  // 接続プールの設定を最適化
  acquireTimeout: 60000, // 接続取得タイムアウト
  timeout: 60000, // クエリタイムアウト
  reconnect: true, // 自動再接続
  // 接続プールの監視設定
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // 接続プールのサイズ制限
  connectionLimit: 10, // 接続数を適切に制限
  queueLimit: 5, // キュー制限を設定
  // 接続の有効期限
  maxIdle: 60000, // アイドル接続の最大時間（ミリ秒）
});

// 接続プールの状態監視
pool.on('connection', (connection) => {
  customLogger.info('新しいデータベース接続が作成されました', {
    threadId: connection.threadId
  });
  
  // 接続エラーの監視
  connection.on('error', (err) => {
    customLogger.error('データベース接続エラー', {
      error: err.message,
      code: err.code,
      threadId: connection.threadId
    });
    
    // エラーが発生した接続を適切に処理
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      customLogger.warn('データベース接続が失われました。再接続を試行します。', {
        threadId: connection.threadId
      });
    }
  });
});

pool.on('acquire', (connection) => {
  customLogger.debug('接続がプールから取得されました', {
    threadId: connection.threadId
  });
});

pool.on('release', (connection) => {
  customLogger.debug('接続がプールに返されました', {
    threadId: connection.threadId
  });
});

// プールエラーの監視
pool.on('error', (err) => {
  customLogger.error('接続プールエラー', {
    error: err.message,
    code: err.code
  });
});

// データベース接続テスト
const testConnection = async () => {
  let connection;
  const startTime = Date.now();
  
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT NOW() as current_datetime');
    const duration = Date.now() - startTime;
    
    // 接続プールの状態をログ出力（安全に取得）
    try {
      const poolStatus = getPoolStatus();
      customLogger.info('データベース接続テスト成功', {
        threadId: connection.threadId,
        duration: `${duration}ms`,
        poolSize: poolStatus.config.connectionLimit,
        activeConnections: poolStatus.activeConnections,
        idleConnections: poolStatus.freeConnections
      });
    } catch (logError) {
      customLogger.warn('接続プール状態の取得に失敗', {
        error: logError.message,
        threadId: connection.threadId
      });
    }
    
    return {
      success: true,
      currentTime: rows[0].current_datetime
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    customLogger.error('データベース接続テスト失敗', {
      error: error.message,
      code: error.code,
      duration: `${duration}ms`
    });
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        customLogger.error('接続の解放に失敗', {
          error: releaseError.message,
          threadId: connection.threadId
        });
      }
    }
  }
};

// 安全なクエリ実行関数
const executeQuery = async (query, params = []) => {
  let connection;
  const startTime = Date.now();
  
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(query, params);
    const duration = Date.now() - startTime;
    
    // クエリ実行ログ
    customLogger.database('execute', query, params, duration, {
      rowCount: rows.length,
      threadId: connection.threadId
    });
    
    return { success: true, data: rows };
  } catch (error) {
    const duration = Date.now() - startTime;
    customLogger.error('クエリ実行エラー', {
      query,
      params,
      error: error.message,
      code: error.code,
      duration: `${duration}ms`,
      threadId: connection?.threadId
    });
    
    return { success: false, error: error.message };
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        customLogger.error('接続の解放に失敗', {
          error: releaseError.message,
          threadId: connection.threadId
        });
      }
    }
  }
};

// 接続プールの取得
const getPool = () => pool;

// 接続プールの状態取得
const getPoolStatus = () => {
  try {
    return {
      totalConnections: pool._allConnections?.length || 0,
      freeConnections: pool._freeConnections?.length || 0,
      activeConnections: (pool._allConnections?.length || 0) - (pool._freeConnections?.length || 0),
      config: {
        connectionLimit: pool.pool?.config?.connectionLimit || 'unknown',
        queueLimit: pool.pool?.config?.queueLimit || 'unknown'
      }
    };
  } catch (error) {
    customLogger.error('接続プール状態取得エラー', {
      error: error.message
    });
    return {
      totalConnections: 0,
      freeConnections: 0,
      activeConnections: 0,
      config: {
        connectionLimit: 'unknown',
        queueLimit: 'unknown'
      }
    };
  }
};

// 接続プールの終了処理
const endPool = async () => {
  try {
    await pool.end();
    customLogger.info('データベース接続プールが正常に終了しました');
  } catch (error) {
    customLogger.error('データベース接続プールの終了に失敗', {
      error: error.message,
      code: error.code
    });
  }
};

// 定期的な接続プールのクリーンアップ
const cleanupPool = async () => {
  try {
    // 期限切れの接続をクリーンアップ
    if (pool._freeConnections) {
      const now = Date.now();
      pool._freeConnections = pool._freeConnections.filter(conn => {
        if (conn._idleStart && (now - conn._idleStart) > 60000) {
          try {
            conn.destroy();
            return false;
          } catch (error) {
            customLogger.error('アイドル接続の破棄に失敗', {
              error: error.message,
              threadId: conn.threadId
            });
            return true;
          }
        }
        return true;
      });
    }
  } catch (error) {
    customLogger.error('接続プールのクリーンアップに失敗', {
      error: error.message
    });
  }
};

// プロセス終了時のクリーンアップ
process.on('SIGINT', async () => {
  customLogger.info('アプリケーションを終了しています...', { signal: 'SIGINT' });
  await endPool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  customLogger.info('アプリケーションを終了しています...', { signal: 'SIGTERM' });
  await endPool();
  process.exit(0);
});

// 定期的なクリーンアップの実行（5分ごと）
setInterval(cleanupPool, 5 * 60 * 1000);

module.exports = {
  pool,
  testConnection,
  executeQuery,
  getPool,
  getPoolStatus,
  endPool,
  cleanupPool
}; 