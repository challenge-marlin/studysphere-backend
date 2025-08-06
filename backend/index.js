require('dotenv').config();
const app = require('./app');
const { testConnection, endPool } = require('./utils/database');
const { memoryMonitor } = require('./utils/memoryMonitor');

const port = process.env.PORT || 5000;

// データベース接続を確認してからサーバーを起動
const startServer = async () => {
  try {
    // SKIP_DB_CHECK環境変数が設定されている場合はDBチェックをスキップ
    if (process.env.SKIP_DB_CHECK === 'true') {
      console.log('Skipping database connection check (SKIP_DB_CHECK=true)');
    } else {
      console.log('Checking database connection...');
      const dbTest = await testConnection();
      
      if (!dbTest.success) {
        console.error('Database connection failed:', dbTest.error);
        process.exit(1);
      }
      
      console.log('Database connection successful:', dbTest.currentTime);
    }
    
    // メモリ監視を開始
    memoryMonitor.startMonitoring(60000); // 1分ごと
    memoryMonitor.takeSnapshot('server_start');
    
    // サーバー起動
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on http://localhost:${port}`);
      console.log('Environment:', process.env.NODE_ENV || 'development');
      console.log('Database:', process.env.DB_NAME || 'curriculum-portal');
      console.log('Memory monitoring: enabled');
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
      
      // メモリ監視を停止
      memoryMonitor.stopMonitoring();
      
      // 最終的なメモリレポートを出力
      console.log('\nFinal Memory Report:');
      console.log(memoryMonitor.generateReport());
      
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
      memoryMonitor.takeSnapshot('uncaught_exception');
      gracefulShutdown('uncaughtException');
    });

    // 未処理のPromise拒否をキャッチ
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      memoryMonitor.takeSnapshot('unhandled_rejection');
      gracefulShutdown('unhandledRejection');
    });

    // メモリ使用量の定期的なレポート（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      setInterval(() => {
        const stats = memoryMonitor.getMemoryStats();
        if (stats) {
          console.log(`Memory: RSS ${stats.current.rss}, Heap ${stats.current.heapUsed}`);
        }
      }, 300000); // 5分ごと
    }

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 