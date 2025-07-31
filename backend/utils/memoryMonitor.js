const { performance } = require('perf_hooks');
const { customLogger } = require('./logger');

// メモリ使用量の監視
class MemoryMonitor {
  constructor() {
    this.memorySnapshots = [];
    this.maxSnapshots = 100; // 最大スナップショット数
    this.monitoringInterval = null;
    this.isMonitoring = false;
  }

  // メモリ使用量のスナップショットを取得
  takeSnapshot(label = '') {
    const memoryUsage = process.memoryUsage();
    const timestamp = Date.now();
    const snapshot = {
      timestamp,
      label,
      rss: memoryUsage.rss, // Resident Set Size
      heapTotal: memoryUsage.heapTotal, // V8ヒープの総サイズ
      heapUsed: memoryUsage.heapUsed, // V8ヒープの使用サイズ
      external: memoryUsage.external, // V8エンジン外のメモリ使用量
      arrayBuffers: memoryUsage.arrayBuffers || 0 // ArrayBufferのメモリ使用量
    };

    this.memorySnapshots.push(snapshot);

    // 最大スナップショット数を超えた場合、古いものを削除
    if (this.memorySnapshots.length > this.maxSnapshots) {
      this.memorySnapshots.shift();
    }

    return snapshot;
  }

  // メモリ使用量の増加を検出
  detectMemoryLeak(threshold = 50 * 1024 * 1024) { // 50MB
    if (this.memorySnapshots.length < 2) {
      return null;
    }

    const recent = this.memorySnapshots.slice(-10); // 最近10個のスナップショット
    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    const rssIncrease = newest.rss - oldest.rss;
    const heapIncrease = newest.heapUsed - oldest.heapUsed;

    if (rssIncrease > threshold || heapIncrease > threshold) {
      return {
        rssIncrease,
        heapIncrease,
        timeSpan: newest.timestamp - oldest.timestamp,
        threshold
      };
    }

    return null;
  }

  // メモリ使用量の統計を取得
  getMemoryStats() {
    if (this.memorySnapshots.length === 0) {
      return null;
    }

    const current = this.memorySnapshots[this.memorySnapshots.length - 1];
    const oldest = this.memorySnapshots[0];

    return {
      current: {
        rss: this.formatBytes(current.rss),
        heapTotal: this.formatBytes(current.heapTotal),
        heapUsed: this.formatBytes(current.heapUsed),
        external: this.formatBytes(current.external),
        arrayBuffers: this.formatBytes(current.arrayBuffers)
      },
      change: {
        rss: this.formatBytes(current.rss - oldest.rss),
        heapUsed: this.formatBytes(current.heapUsed - oldest.heapUsed)
      },
      timeSpan: current.timestamp - oldest.timestamp
    };
  }

  // バイト数を読みやすい形式に変換
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 定期的なメモリ監視を開始
  startMonitoring(intervalMs = 30000) { // 30秒ごと
    if (this.isMonitoring) {
      customLogger.warn('Memory monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      const snapshot = this.takeSnapshot('periodic');
      const leak = this.detectMemoryLeak();
      
      if (leak) {
        customLogger.warn('Potential memory leak detected', {
          rssIncrease: leak.rssIncrease,
          heapIncrease: leak.heapIncrease,
          timeSpan: leak.timeSpan,
          threshold: leak.threshold
        });
      }

      // メモリ使用量が高い場合の警告
      if (snapshot.rss > 500 * 1024 * 1024) { // 500MB
        customLogger.warn('High memory usage detected', {
          rss: this.formatBytes(snapshot.rss),
          heapUsed: this.formatBytes(snapshot.heapUsed)
        });
      }
      
      // 定期的なメモリ使用量ログ
      customLogger.memory(snapshot);
    }, intervalMs);

    customLogger.info(`Memory monitoring started`, { interval: `${intervalMs}ms` });
  }

  // メモリ監視を停止
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.isMonitoring = false;
      customLogger.info('Memory monitoring stopped');
    }
  }

  // メモリスナップショットをクリア
  clearSnapshots() {
    this.memorySnapshots = [];
    customLogger.info('Memory snapshots cleared');
  }

  // メモリ使用量の詳細レポートを生成
  generateReport() {
    const stats = this.getMemoryStats();
    if (!stats) {
      return 'No memory data available';
    }

    return `
Memory Usage Report:
===================
Current Usage:
  RSS: ${stats.current.rss}
  Heap Total: ${stats.current.heapTotal}
  Heap Used: ${stats.current.heapUsed}
  External: ${stats.current.external}
  Array Buffers: ${stats.current.arrayBuffers}

Change Since Start:
  RSS: ${stats.change.rss}
  Heap Used: ${stats.change.heapUsed}
  Time Span: ${Math.round(stats.timeSpan / 1000)}s

Snapshots: ${this.memorySnapshots.length}
    `.trim();
  }
}

// グローバルなメモリモニターインスタンス
const memoryMonitor = new MemoryMonitor();

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  memoryMonitor.stopMonitoring();
  customLogger.info('Memory monitoring cleanup completed', { signal: 'SIGINT' });
});

process.on('SIGTERM', () => {
  memoryMonitor.stopMonitoring();
  customLogger.info('Memory monitoring cleanup completed', { signal: 'SIGTERM' });
});

module.exports = {
  MemoryMonitor,
  memoryMonitor
}; 