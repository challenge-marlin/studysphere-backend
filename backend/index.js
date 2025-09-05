// AWS SDK v2の警告を抑制
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('AWS SDK for JavaScript')) {
    // AWS SDK v2の警告は無視
    return;
  }
  console.warn(warning.name, warning.message);
});

// Docker環境では環境変数はdocker-compose.ymlで設定されるため、.envファイルは読み込まない
// ローカル開発環境でのみ.envファイルを読み込む
if (process.env.NODE_ENV !== 'production') {
  const path = require('path');
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}
const app = require('./app');
const { testConnection, endPool } = require('./utils/database');
const { memoryMonitor } = require('./utils/memoryMonitor');

const port = process.env.PORT || 5050;

// データベース接続を確認してからサーバーを起動
const startServer = async () => {
  try {
    // SKIP_DB_CHECK環境変数が設定されている場合はDBチェックをスキップ
    if (process.env.SKIP_DB_CHECK === 'true') {
      console.log('Skipping database connection check (SKIP_DB_CHECK=true)');
    } else {
      console.log('Checking database connection...');
      try {
        const dbTest = await testConnection();
        
        if (!dbTest.success) {
          console.error('Database connection failed:', dbTest.error);
          console.log('Continuing without database connection...');
        } else {
          console.log('Database connection successful:', dbTest.currentTime);
        }
      } catch (dbError) {
        console.error('Database connection error:', dbError.message);
        console.log('Continuing without database connection...');
      }
    }
    
    // メモリ監視を初期化（安全に）
    try {
      if (memoryMonitor && typeof memoryMonitor.startMonitoring === 'function') {
        memoryMonitor.startMonitoring(60000); // 1分ごとに監視
        console.log('Memory monitoring started successfully');
      } else {
        console.log('Memory monitoring not available');
      }
    } catch (monitorError) {
      console.warn('Memory monitoring initialization failed:', monitorError.message);
      console.log('Continuing without memory monitoring...');
    }
    
    // サーバー起動
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on http://localhost:${port}`);
      console.log('Environment:', process.env.NODE_ENV || 'development');
      console.log('Database:', process.env.DB_NAME || 'curriculum-portal');
      console.log('Memory monitoring: enabled');
      
      // 環境変数のデバッグログ
      console.log('=== Environment Variables Debug ===');
      console.log('NODE_ENV:', process.env.NODE_ENV);
      console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
      console.log('AWS_ACCESS_KEY_ID exists:', !!process.env.AWS_ACCESS_KEY_ID);
      console.log('AWS_SECRET_ACCESS_KEY exists:', !!process.env.AWS_SECRET_ACCESS_KEY);
      console.log('AWS_REGION:', process.env.AWS_REGION);
      console.log('AWS_S3_BUCKET:', process.env.AWS_S3_BUCKET);
      console.log('==================================');
    });

    // サーバーのタイムアウト設定
    server.timeout = 10 * 60 * 1000; // 10分のタイムアウト
    server.keepAliveTimeout = 65 * 1000; // 65秒のkeep-aliveタイムアウト
    server.headersTimeout = 66 * 1000; // 66秒のヘッダータイムアウト
    
    console.log('Server timeout settings:', {
      timeout: server.timeout,
      keepAliveTimeout: server.keepAliveTimeout,
      headersTimeout: server.headersTimeout
    });

    // サーバーのエラーハンドリング
    server.on('error', (error) => {
      console.error('Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
        process.exit(1);
      }
    });

    // プロセス終了時のクリーンアップ
    const gracefulShutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
      
      // メモリ監視を停止（安全に）
      try {
        if (memoryMonitor && typeof memoryMonitor.stopMonitoring === 'function') {
          memoryMonitor.stopMonitoring();
          
          // 最終的なメモリレポートを出力
          if (typeof memoryMonitor.generateReport === 'function') {
            console.log('\nFinal Memory Report:');
            console.log(memoryMonitor.generateReport());
          }
        }
      } catch (monitorError) {
        console.warn('Memory monitoring cleanup failed:', monitorError.message);
      }
      
      // サーバーを停止
      server.close(() => {
        console.log('HTTP server closed');
      });

      // データベース接続プールを終了
      try {
        await endPool();
        console.log('Database connections closed');
      } catch (error) {
        console.error('Error closing database connections:', error);
      }

      // プロセスを終了
      process.exit(0);
    };

    // シグナルハンドラーを設定
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // 未処理の例外をキャッチ
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      try {
        if (memoryMonitor && typeof memoryMonitor.takeSnapshot === 'function') {
          memoryMonitor.takeSnapshot('uncaught_exception');
        }
      } catch (monitorError) {
        console.warn('Memory monitoring snapshot failed:', monitorError.message);
      }
      gracefulShutdown('uncaughtException');
    });

    // 未処理のPromise拒否をキャッチ
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      try {
        if (memoryMonitor && typeof memoryMonitor.takeSnapshot === 'function') {
          memoryMonitor.takeSnapshot('unhandled_rejection');
        }
      } catch (monitorError) {
        console.warn('Memory monitoring snapshot failed:', monitorError.message);
      }
      gracefulShutdown('unhandledRejection');
    });

    // メモリ使用量の定期的なレポート（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      setInterval(() => {
        try {
          if (memoryMonitor && typeof memoryMonitor.getMemoryStats === 'function') {
            const stats = memoryMonitor.getMemoryStats();
            if (stats) {
              console.log(`Memory: RSS ${stats.current.rss}, Heap ${stats.current.heapUsed}`);
            }
          }
        } catch (monitorError) {
          console.warn('Memory stats collection failed:', monitorError.message);
        }
      }, 300000); // 5分ごと
    }

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 