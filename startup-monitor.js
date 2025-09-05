#!/usr/bin/env node

/**
 * StudySphere Startup Monitor
 * 起動プロセスの監視と異常検出を行うスクリプト
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { customLogger } = require('./backend/utils/logger');

class StartupMonitor {
  constructor() {
    // 日付ベースのログディレクトリを作成
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    this.logDir = path.join(__dirname, 'logs', String(year), month, day);
    this.startupLog = path.join(this.logDir, 'startup-monitor.log');
    this.errorLog = path.join(this.logDir, 'startup-monitor-errors.log');
    this.processes = new Map();
    this.startTime = Date.now();
    this.healthChecks = [];
    
    // ログディレクトリの作成
    this.ensureLogDirectory();
    
    // ログの初期化
    this.log('Startup Monitor initialized', { startTime: new Date().toISOString() });
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message} ${JSON.stringify(meta)}`;
    
    // ファイルにログを記録
    fs.appendFileSync(this.startupLog, logEntry + '\n');
    
    // コンソールに出力
    console.log(logEntry);
    
    // Winstonロガーにも記録
    try {
      customLogger.info(`Startup Monitor: ${message}`, meta);
    } catch (error) {
      // Winstonロガーが利用できない場合は無視
    }
  }

  logError(message, error = null, meta = {}) {
    const timestamp = new Date().toISOString();
    const errorInfo = error ? {
      message: error.message,
      stack: error.stack,
      code: error.code
    } : {};
    
    const logEntry = `[${timestamp}] ERROR: ${message} ${JSON.stringify({ ...meta, ...errorInfo })}`;
    
    // エラーログファイルに記録
    fs.appendFileSync(this.errorLog, logEntry + '\n');
    
    // 通常のログファイルにも記録
    fs.appendFileSync(this.startupLog, logEntry + '\n');
    
    // コンソールに出力
    console.error(logEntry);
    
    // Winstonロガーにも記録
    try {
      customLogger.error(`Startup Monitor Error: ${message}`, { ...meta, ...errorInfo });
    } catch (loggerError) {
      // Winstonロガーが利用できない場合は無視
    }
  }

  // プロセスの監視を開始
  monitorProcess(name, command, args = [], options = {}) {
    this.log(`Starting process monitoring: ${name}`, { command, args });
    
    try {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
      });
      
      this.processes.set(name, process);
      
      // 標準出力の監視
      process.stdout.on('data', (data) => {
        const output = data.toString().trim();
        this.log(`Process ${name} stdout`, { process: name, output });
      });
      
      // 標準エラーの監視
      process.stderr.on('data', (data) => {
        const output = data.toString().trim();
        this.logError(`Process ${name} stderr`, null, { process: name, output });
      });
      
      // プロセス終了の監視
      process.on('close', (code, signal) => {
        this.log(`Process ${name} closed`, { process: name, code, signal });
        this.processes.delete(name);
        
        if (code !== 0) {
          this.logError(`Process ${name} exited with non-zero code`, null, { 
            process: name, 
            code, 
            signal,
            uptime: Date.now() - this.startTime
          });
        }
      });
      
      // プロセスエラーの監視
      process.on('error', (error) => {
        this.logError(`Process ${name} error`, error, { process: name });
      });
      
      // プロセス終了の監視
      process.on('exit', (code, signal) => {
        this.log(`Process ${name} exited`, { process: name, code, signal });
      });
      
      this.log(`Process monitoring started for: ${name}`, { 
        pid: process.pid,
        command: `${command} ${args.join(' ')}`
      });
      
      return process;
      
    } catch (error) {
      this.logError(`Failed to start process monitoring for ${name}`, error, { command, args });
      throw error;
    }
  }

  // Docker Compose起動の監視
  async monitorDockerCompose(composeFile = 'docker-compose.yml') {
    this.log('Starting Docker Compose monitoring', { composeFile });
    
    try {
      // docker-compose.ymlファイルの存在確認
      if (!fs.existsSync(composeFile)) {
        throw new Error(`Docker Compose file not found: ${composeFile}`);
      }
      
      // Docker Compose起動
      const process = this.monitorProcess('docker-compose', 'docker', ['compose', 'up', '-d'], {
        cwd: path.dirname(composeFile)
      });
      
      // 起動完了を待機
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Docker Compose startup timeout'));
        }, 300000); // 5分
        
        process.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0) {
            this.log('Docker Compose started successfully');
            resolve();
          } else {
            reject(new Error(`Docker Compose failed with code: ${code}`));
          }
        });
        
        process.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
    } catch (error) {
      this.logError('Docker Compose monitoring failed', error);
      throw error;
    }
  }

  // サービスヘルスチェック
  async healthCheck(service, checkFunction, interval = 10000, maxAttempts = 30) {
    this.log(`Starting health check for service: ${service}`, { interval, maxAttempts });
    
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const check = async () => {
        attempts++;
        
        try {
          const result = await checkFunction();
          
          if (result.healthy) {
            this.log(`Service ${service} is healthy`, { 
              attempts, 
              uptime: Date.now() - this.startTime,
              details: result.details 
            });
            resolve(result);
          } else {
            this.log(`Service ${service} health check failed`, { 
              attempts, 
              details: result.details 
            });
            
            if (attempts >= maxAttempts) {
              reject(new Error(`Service ${service} health check failed after ${maxAttempts} attempts`));
            } else {
              setTimeout(check, interval);
            }
          }
        } catch (error) {
          this.logError(`Service ${service} health check error`, error, { attempts });
          
          if (attempts >= maxAttempts) {
            reject(error);
          } else {
            setTimeout(check, interval);
          }
        }
      };
      
      check();
    });
  }

  // データベースヘルスチェック
  async checkDatabaseHealth() {
    try {
      const { exec } = require('child_process');
      
      return new Promise((resolve) => {
        exec('docker compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926!', (error, stdout, stderr) => {
          if (error) {
            resolve({
              healthy: false,
              details: { error: error.message, stderr }
            });
          } else {
            resolve({
              healthy: true,
              details: { stdout: stdout.trim() }
            });
          }
        });
      });
    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }

  // バックエンドヘルスチェック
  async checkBackendHealth() {
    try {
      const http = require('http');
      
      return new Promise((resolve) => {
        const req = http.request('http://localhost:5000/', { method: 'GET' }, (res) => {
          resolve({
            healthy: res.statusCode < 400,
            details: { 
              statusCode: res.statusCode,
              headers: res.headers
            }
          });
        });
        
        req.on('error', (error) => {
          resolve({
            healthy: false,
            details: { error: error.message }
          });
        });
        
        req.setTimeout(5000, () => {
          req.destroy();
          resolve({
            healthy: false,
            details: { error: 'Request timeout' }
          });
        });
        
        req.end();
      });
    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }

  // メモリ使用量の監視
  monitorMemoryUsage(interval = 30000) {
    this.log('Starting memory usage monitoring', { interval });
    
    const memoryInterval = setInterval(() => {
      try {
        const memUsage = process.memoryUsage();
        const memoryInfo = {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024)
        };
        
        this.log('Memory usage', memoryInfo);
        
        // メモリ使用量が高い場合の警告
        if (memoryInfo.rss > 500) {
          this.logError('High memory usage detected', null, memoryInfo);
        }
        
      } catch (error) {
        this.logError('Memory monitoring error', error);
      }
    }, interval);
    
    // クリーンアップ関数を返す
    return () => {
      clearInterval(memoryInterval);
      this.log('Memory monitoring stopped');
    };
  }

  // 起動完了の確認
  async waitForStartup() {
    this.log('Waiting for all services to be ready...');
    
    try {
      // データベースの準備完了を待機
      await this.healthCheck('database', this.checkDatabaseHealth, 5000, 60);
      
      // バックエンドの準備完了を待機
      await this.healthCheck('backend', this.checkBackendHealth, 5000, 60);
      
      this.log('All services are ready', { 
        totalUptime: Date.now() - this.startTime 
      });
      
      return true;
      
    } catch (error) {
      this.logError('Startup failed', error, { 
        totalUptime: Date.now() - this.startTime 
      });
      throw error;
    }
  }

  // 監視の停止
  stop() {
    this.log('Stopping startup monitor');
    
    // 監視中のプロセスを停止
    for (const [name, process] of this.processes) {
      this.log(`Stopping process: ${name}`);
      try {
        process.kill('SIGTERM');
      } catch (error) {
        this.logError(`Failed to stop process: ${name}`, error);
      }
    }
    
    // プロセスリストをクリア
    this.processes.clear();
    
    this.log('Startup monitor stopped');
  }

  // 監視レポートの生成
  generateReport() {
    const report = {
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      processes: Array.from(this.processes.keys()),
      logFiles: {
        startup: this.startupLog,
        errors: this.errorLog
      }
    };
    
    this.log('Startup monitor report generated', report);
    return report;
  }
}

// メイン実行部分
if (require.main === module) {
  const monitor = new StartupMonitor();
  
  // シグナルハンドラー
  process.on('SIGINT', () => {
    monitor.log('Received SIGINT, shutting down...');
    monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    monitor.log('Received SIGTERM, shutting down...');
    monitor.stop();
    process.exit(0);
  });
  
  // 未処理の例外をキャッチ
  process.on('uncaughtException', (error) => {
    monitor.logError('Uncaught exception', error);
    monitor.stop();
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    monitor.logError('Unhandled rejection', reason);
    monitor.stop();
    process.exit(1);
  });
  
  // 起動監視の開始
  (async () => {
    try {
      // Docker Compose起動の監視
      await monitor.monitorDockerCompose();
      
      // メモリ使用量の監視開始
      const stopMemoryMonitoring = monitor.monitorMemoryUsage();
      
      // 起動完了を待機
      await monitor.waitForStartup();
      
      // 起動完了レポート
      const report = monitor.generateReport();
      console.log('\n=== Startup Monitor Report ===');
      console.log(JSON.stringify(report, null, 2));
      console.log('==============================\n');
      
      // メモリ監視を停止
      stopMemoryMonitoring();
      
      // 監視を停止
      monitor.stop();
      
      console.log('Startup monitoring completed successfully');
      process.exit(0);
      
    } catch (error) {
      monitor.logError('Startup monitoring failed', error);
      monitor.stop();
      process.exit(1);
    }
  })();
}

module.exports = StartupMonitor;
