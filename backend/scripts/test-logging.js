#!/usr/bin/env node

/**
 * ログ機能のテストとログファイルの確認を行うスクリプト
 * ログが正しく記録されているかを確認
 */

const path = require('path');
const fs = require('fs');

// ロガーのインポート
const { customLogger, getLogDir, getLogFiles } = require('../utils/logger');

// ログテスト関数
async function testLogging() {
  console.log('=== ログ機能テスト開始 ===\n');
  
  try {
    // 1. ロガーの基本情報を確認
    console.log('1. ロガーの基本情報');
    console.log(`ログレベル: ${customLogger.getLevel()}`);
    console.log(`ログディレクトリ: ${getLogDir()}`);
    
    // 2. 各レベルのログをテスト
    console.log('\n2. 各レベルのログテスト');
    
    customLogger.debug('これはデバッグログです', { test: true, level: 'debug' });
    customLogger.info('これは情報ログです', { test: true, level: 'info' });
    customLogger.warn('これは警告ログです', { test: true, level: 'warn' });
    customLogger.error('これはエラーログです', { test: true, level: 'error' });
    
    // 3. 特殊なログメソッドをテスト
    console.log('\n3. 特殊なログメソッドテスト');
    
    // リクエストログのテスト
    const mockReq = {
      method: 'POST',
      url: '/api/test',
      ip: '127.0.0.1',
      get: (header) => header === 'User-Agent' ? 'Test-Agent' : null,
      headers: { 'content-type': 'application/json' },
      body: { test: 'data' },
      query: { param: 'value' },
      params: { id: '123' }
    };
    
    customLogger.request(mockReq, { test: true });
    
    // レスポンスログのテスト
    const mockRes = {
      statusCode: 200,
      get: (header) => header === 'Content-Length' ? '1024' : null
    };
    
    customLogger.response(mockReq, mockRes, 150, { test: true });
    
    // データベースログのテスト
    customLogger.database('SELECT', 'SELECT * FROM users', ['user1'], 25, { test: true });
    
    // 認証ログのテスト
    customLogger.auth('login', 'user123', true, { 
      test: true, 
      ip: '127.0.0.1', 
      userAgent: 'Test-Agent' 
    });
    
    // パフォーマンスログのテスト
    customLogger.performance('database_query', 1500, { test: true });
    
    // システムログのテスト
    customLogger.system('test_event', { test: true });
    
    // メモリ使用量ログのテスト
    const memoryStats = process.memoryUsage();
    customLogger.memory(memoryStats, { test: true });
    
    // エラーログのテスト
    const testError = new Error('テスト用エラー');
    testError.code = 'TEST_ERROR';
    customLogger.errorWithStack(testError, { test: true, context: 'test_context' });
    
    // 4. ログファイルの確認
    console.log('\n4. ログファイルの確認');
    await new Promise(resolve => setTimeout(resolve, 1000)); // ログの書き込みを待つ
    
    const logFiles = customLogger.getLogFiles();
    console.log('現在のログファイル:');
    logFiles.forEach(file => {
      console.log(`  - ${file.name}: ${file.size} bytes`);
    });
    
    // 5. ログファイルの内容確認
    console.log('\n5. ログファイルの内容確認');
    if (logFiles.length > 0) {
      const combinedLog = logFiles.find(f => f.name === 'combined.log');
      if (combinedLog) {
        try {
          const logContent = fs.readFileSync(combinedLog.path, 'utf8');
          const lines = logContent.split('\n').filter(line => line.trim());
          console.log(`combined.log の最新の5行:`);
          lines.slice(-5).forEach((line, index) => {
            console.log(`  ${lines.length - 4 + index}: ${line.substring(0, 100)}...`);
          });
        } catch (error) {
          console.error('ログファイルの読み込みに失敗:', error.message);
        }
      }
    }
    
    // 6. ログの即座フラッシュテスト
    console.log('\n6. ログの即座フラッシュテスト');
    customLogger.info('フラッシュテスト用ログ', { test: true, flush: true });
    
    // 7. ログディレクトリの権限確認
    console.log('\n7. ログディレクトリの権限確認');
    try {
      const logDir = getLogDir();
      const stats = fs.statSync(logDir);
      const mode = stats.mode & 0o777;
      console.log(`ログディレクトリ権限: ${mode.toString(8)} (${mode === 0o755 ? '適切' : '不適切'})`);
      
      // 書き込みテスト
      const testFile = path.join(logDir, 'test-write.log');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log('ログディレクトリへの書き込み: 成功');
    } catch (error) {
      console.error('ログディレクトリの権限確認に失敗:', error.message);
    }
    
    console.log('\n=== ログ機能テスト完了 ===');
    
  } catch (error) {
    console.error('ログテスト中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// ログファイルの監視関数
function monitorLogs(duration = 30000) {
  console.log(`\n=== ログファイル監視開始 (${duration / 1000}秒間) ===`);
  
  const startTime = Date.now();
  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const logFiles = customLogger.getLogFiles();
    
    console.log(`[${Math.round(elapsed / 1000)}s] ログファイル数: ${logFiles.length}`);
    logFiles.forEach(file => {
      console.log(`  - ${file.name}: ${file.size} bytes`);
    });
    
    if (elapsed >= duration) {
      clearInterval(interval);
      console.log('=== ログファイル監視完了 ===');
    }
  }, 5000);
}

// メイン処理
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--monitor')) {
    const duration = parseInt(args[args.indexOf('--monitor') + 1]) || 30000;
    monitorLogs(duration);
  } else {
    await testLogging();
  }
}

// スクリプトが直接実行された場合の処理
if (require.main === module) {
  main().then(() => {
    console.log('ログテストが正常に完了しました');
    process.exit(0);
  }).catch((error) => {
    console.error('ログテストが失敗しました:', error);
    process.exit(1);
  });
}

module.exports = { testLogging, monitorLogs };
