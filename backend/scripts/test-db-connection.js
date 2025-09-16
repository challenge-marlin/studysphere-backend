#!/usr/bin/env node

/**
 * データベース接続をテストするスクリプト
 */

const mysql = require('mysql2/promise');
const { dbConfig } = require('../config/database');

async function testDatabaseConnection() {
  console.log('=== データベース接続テスト開始 ===');
  console.log('設定:', {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    database: dbConfig.database
  });
  
  let connection;
  
  try {
    // データベース接続をテスト
    console.log('\n1. データベース接続テスト...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ データベース接続成功');
    
    // データベースの状態を確認
    console.log('\n2. データベース状態確認...');
    const [rows] = await connection.execute('SELECT VERSION() as version');
    console.log('✓ MySQL バージョン:', rows[0].version);
    
    // テーブル一覧を確認
    console.log('\n3. テーブル一覧確認...');
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('✓ テーブル数:', tables.length);
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`  ${index + 1}. ${tableName}`);
    });
    
    // 学習進捗テーブルの確認
    console.log('\n4. 学習進捗テーブル確認...');
    try {
      const [progressRows] = await connection.execute('SELECT COUNT(*) as count FROM learning_progress');
      console.log('✓ 学習進捗レコード数:', progressRows[0].count);
    } catch (error) {
      console.log('⚠ 学習進捗テーブルが存在しません:', error.message);
    }
    
    // レッスンテーブルの確認
    console.log('\n5. レッスンテーブル確認...');
    try {
      const [lessonRows] = await connection.execute('SELECT COUNT(*) as count FROM lessons');
      console.log('✓ レッスンレコード数:', lessonRows[0].count);
    } catch (error) {
      console.log('⚠ レッスンテーブルが存在しません:', error.message);
    }
    
    console.log('\n=== データベース接続テスト完了 ===');
    
  } catch (error) {
    console.error('\n✗ データベース接続テスト失敗:', error.message);
    console.error('エラー詳細:', error);
    
    // エラーの種類に応じた対処法を提案
    if (error.code === 'ECONNREFUSED') {
      console.log('\n対処法:');
      console.log('1. MySQLサーバーが起動しているかを確認してください');
      console.log('2. ポート番号が正しいかを確認してください（現在:', dbConfig.port, '）');
      console.log('3. ファイアウォールの設定を確認してください');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n対処法:');
      console.log('1. ユーザー名とパスワードが正しいかを確認してください');
      console.log('2. データベースへのアクセス権限を確認してください');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n対処法:');
      console.log('1. データベース名が正しいかを確認してください');
      console.log('2. データベースが存在するかを確認してください');
    }
    
    process.exit(1);
    
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nデータベース接続を閉じました');
    }
  }
}

// スクリプトが直接実行された場合の処理
if (require.main === module) {
  testDatabaseConnection().then(() => {
    console.log('テストが正常に完了しました');
    process.exit(0);
  }).catch((error) => {
    console.error('テストが失敗しました:', error);
    process.exit(1);
  });
}

module.exports = { testDatabaseConnection };
