#!/usr/bin/env node

/**
 * ログファイルの管理、確認、クリーンアップを行うコマンドラインツール
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ロガーのインポート
const { customLogger, getLogDir, getLogFiles, cleanupOldLogs } = require('../utils/logger');

// コマンドライン引数の解析
const args = process.argv.slice(2);
const command = args[0] || 'help';

// ヘルプ表示
function showHelp() {
  console.log(`
ログ管理ツール - 使用方法

コマンド:
  list                   現在のログファイル一覧を表示
  show <filename>        指定されたログファイルの内容を表示
  tail <filename> [lines] ログファイルの末尾を表示（デフォルト: 10行）
  search <filename> <query> ログファイル内でキーワード検索
  clean [days]           古いログファイルを削除（デフォルト: 30日）
  stats                  ログファイルの統計情報を表示
  monitor [duration]     ログファイルの監視（デフォルト: 60秒）
  test                   ログ機能のテスト実行
  help                   このヘルプを表示

例:
  node log-manager.js list
  node log-manager.js show combined.log
  node log-manager.js tail error.log 20
  node log-manager.js search combined.log "PDF"
  node log-manager.js clean 7
  node log-manager.js stats
  node log-manager.js monitor 120
  node log-manager.js test
`);
}

// ログファイル一覧表示
function listLogFiles() {
  console.log('=== ログファイル一覧 ===');
  
  try {
    const logDir = getLogDir();
    const files = getLogFiles();
    
    if (files.length === 0) {
      console.log('ログファイルが見つかりません');
      return;
    }
    
    console.log(`ログディレクトリ: ${logDir}\n`);
    
    files.forEach((file, index) => {
      const sizeKB = Math.round(file.size / 1024 * 100) / 100;
      const sizeMB = Math.round(file.size / 1024 / 1024 * 100) / 100;
      const sizeStr = sizeMB > 1 ? `${sizeMB} MB` : `${sizeKB} KB`;
      
      console.log(`${index + 1}. ${file.name}`);
      console.log(`   サイズ: ${sizeStr} (${file.size} bytes)`);
      console.log(`   パス: ${file.path}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('ログファイル一覧の取得に失敗:', error.message);
  }
}

// ログファイル内容表示
function showLogFile(filename) {
  if (!filename) {
    console.error('ファイル名を指定してください');
    return;
  }
  
  try {
    const logDir = getLogDir();
    const filePath = path.join(logDir, filename);
    
    if (!fs.existsSync(filePath)) {
      console.error(`ファイルが見つかりません: ${filename}`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`=== ${filename} の内容 ===`);
    console.log(content);
    
  } catch (error) {
    console.error('ログファイルの読み込みに失敗:', error.message);
  }
}

// ログファイルの末尾表示
function tailLogFile(filename, lines = 10) {
  if (!filename) {
    console.error('ファイル名を指定してください');
    return;
  }
  
  try {
    const logDir = getLogDir();
    const filePath = path.join(logDir, filename);
    
    if (!fs.existsSync(filePath)) {
      console.error(`ファイルが見つかりません: ${filename}`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const allLines = content.split('\n').filter(line => line.trim());
    const tailLines = allLines.slice(-lines);
    
    console.log(`=== ${filename} の末尾${lines}行 ===`);
    tailLines.forEach((line, index) => {
      console.log(`${allLines.length - lines + index + 1}: ${line}`);
    });
    
  } catch (error) {
    console.error('ログファイルの読み込みに失敗:', error.message);
  }
}

// ログファイル内検索
function searchLogFile(filename, query) {
  if (!filename || !query) {
    console.error('ファイル名と検索クエリを指定してください');
    return;
  }
  
  try {
    const logDir = getLogDir();
    const filePath = path.join(logDir, filename);
    
    if (!fs.existsSync(filePath)) {
      console.error(`ファイルが見つかりません: ${filename}`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const matches = [];
    
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        matches.push({ lineNumber: index + 1, content: line });
      }
    });
    
    console.log(`=== ${filename} で "${query}" を検索した結果 ===`);
    console.log(`検索結果: ${matches.length}件\n`);
    
    matches.forEach(match => {
      console.log(`${match.lineNumber}: ${match.content}`);
    });
    
  } catch (error) {
    console.error('ログファイルの検索に失敗:', error.message);
  }
}

// ログファイルのクリーンアップ
function cleanLogs(days = 30) {
  console.log(`=== ${days}日より古いログファイルを削除 ===`);
  
  try {
    cleanupOldLogs(days);
    console.log('ログファイルのクリーンアップが完了しました');
  } catch (error) {
    console.error('ログファイルのクリーンアップに失敗:', error.message);
  }
}

// ログファイルの統計情報
function showLogStats() {
  console.log('=== ログファイル統計情報 ===');
  
  try {
    const logDir = getLogDir();
    const files = getLogFiles();
    
    if (files.length === 0) {
      console.log('ログファイルが見つかりません');
      return;
    }
    
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = Math.round(totalSize / 1024 / 1024 * 100) / 100;
    
    console.log(`ログディレクトリ: ${logDir}`);
    console.log(`ファイル数: ${files.length}`);
    console.log(`総サイズ: ${totalSizeMB} MB (${totalSize} bytes)`);
    console.log('');
    
    // ファイルタイプ別の統計
    const fileTypes = {};
    files.forEach(file => {
      const ext = path.extname(file.name) || 'no-extension';
      if (!fileTypes[ext]) {
        fileTypes[ext] = { count: 0, size: 0 };
      }
      fileTypes[ext].count++;
      fileTypes[ext].size += file.size;
    });
    
    console.log('ファイルタイプ別統計:');
    Object.entries(fileTypes).forEach(([ext, stats]) => {
      const sizeMB = Math.round(stats.size / 1024 / 1024 * 100) / 100;
      console.log(`  ${ext}: ${stats.count}ファイル, ${sizeMB} MB`);
    });
    
    // 最新・最古のファイル
    const sortedFiles = files.sort((a, b) => {
      const statsA = fs.statSync(a.path);
      const statsB = fs.statSync(b.path);
      return statsA.mtime.getTime() - statsB.mtime.getTime();
    });
    
    if (sortedFiles.length > 0) {
      const oldest = fs.statSync(sortedFiles[0].path);
      const newest = fs.statSync(sortedFiles[sortedFiles.length - 1].path);
      
      console.log('');
      console.log(`最古のファイル: ${sortedFiles[0].name} (${oldest.mtime.toLocaleString()})`);
      console.log(`最新のファイル: ${sortedFiles[sortedFiles.length - 1].name} (${newest.mtime.toLocaleString()})`);
    }
    
  } catch (error) {
    console.error('ログ統計情報の取得に失敗:', error.message);
  }
}

// ログファイルの監視
function monitorLogs(duration = 60) {
  console.log(`=== ログファイル監視開始 (${duration}秒間) ===`);
  
  const startTime = Date.now();
  const interval = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const remaining = duration - elapsed;
    
    try {
      const files = getLogFiles();
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const totalSizeMB = Math.round(totalSize / 1024 / 1024 * 100) / 100;
      
      console.log(`[${elapsed}s] ファイル数: ${files.length}, 総サイズ: ${totalSizeMB} MB`);
      
      if (remaining <= 0) {
        clearInterval(interval);
        console.log('=== ログファイル監視完了 ===');
      }
    } catch (error) {
      console.error('ログファイル監視エラー:', error.message);
    }
  }, 5000);
}

// ログ機能のテスト
async function testLogging() {
  console.log('=== ログ機能テスト実行 ===');
  
  try {
    const { testLogging } = require('./test-logging');
    await testLogging();
  } catch (error) {
    console.error('ログ機能テストの実行に失敗:', error.message);
  }
}

// メイン処理
function main() {
  switch (command) {
    case 'list':
      listLogFiles();
      break;
      
    case 'show':
      showLogFile(args[1]);
      break;
      
    case 'tail':
      const lines = parseInt(args[2]) || 10;
      tailLogFile(args[1], lines);
      break;
      
    case 'search':
      searchLogFile(args[1], args[2]);
      break;
      
    case 'clean':
      const days = parseInt(args[1]) || 30;
      cleanLogs(days);
      break;
      
    case 'stats':
      showLogStats();
      break;
      
    case 'monitor':
      const duration = parseInt(args[1]) || 60;
      monitorLogs(duration);
      break;
      
    case 'test':
      testLogging();
      break;
      
    case 'help':
    default:
      showHelp();
      break;
  }
}

// スクリプトが直接実行された場合の処理
if (require.main === module) {
  main();
}

module.exports = {
  listLogFiles,
  showLogFile,
  tailLogFile,
  searchLogFile,
  cleanLogs,
  showLogStats,
  monitorLogs,
  testLogging
};
