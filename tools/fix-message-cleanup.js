#!/usr/bin/env node

/**
 * メッセージ自動削除イベントを修正するスクリプト
 */

const mysql = require('mysql2/promise');

// データベース設定を直接指定
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shinomoto926!',
  database: process.env.DB_NAME || 'curriculum-portal',
  port: process.env.DB_PORT || 3307,
  charset: 'utf8mb4',
  ssl: false
};

async function fixMessageCleanup() {
  console.log('=== メッセージ自動削除イベント修正開始 ===');
  
  let connection;
  
  try {
    // データベース接続
    console.log('\n1. データベース接続...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ データベース接続成功');
    
    // 既存のイベントを削除
    console.log('\n2. 既存のイベントを削除...');
    try {
      await connection.query('DROP EVENT IF EXISTS cleanup_expired_personal_messages');
      console.log('✓ 既存の個人メッセージ削除イベントを削除');
    } catch (error) {
      console.log('⚠ イベント削除エラー（無視）:', error.message);
    }
    
    try {
      await connection.query('DROP EVENT IF EXISTS cleanup_expired_announcements');
      console.log('✓ 既存のアナウンス削除イベントを削除');
    } catch (error) {
      console.log('⚠ イベント削除エラー（無視）:', error.message);
    }
    
    // イベントスケジューラーを有効化
    console.log('\n3. イベントスケジューラーを有効化...');
    await connection.query('SET GLOBAL event_scheduler = ON');
    console.log('✓ イベントスケジューラーを有効化');
    
    // 新しい個人メッセージ削除イベントを作成
    console.log('\n4. 新しい個人メッセージ削除イベントを作成...');
    await connection.query(`
      CREATE EVENT cleanup_expired_personal_messages
      ON SCHEDULE EVERY 1 HOUR
      STARTS CURRENT_TIMESTAMP
      DO
        DELETE FROM personal_messages 
        WHERE expires_at <= NOW()
    `);
    console.log('✓ 個人メッセージ削除イベントを作成（1時間ごと実行）');
    
    // 新しいアナウンス削除イベントを作成
    console.log('\n5. 新しいアナウンス削除イベントを作成...');
    await connection.query(`
      CREATE EVENT cleanup_expired_announcements
      ON SCHEDULE EVERY 1 HOUR
      STARTS CURRENT_TIMESTAMP
      DO
        DELETE FROM announcements 
        WHERE expires_at <= NOW()
    `);
    console.log('✓ アナウンス削除イベントを作成（1時間ごと実行）');
    
    // イベント一覧確認
    console.log('\n6. イベント一覧確認...');
    const [events] = await connection.execute('SHOW EVENTS');
    console.log('✓ イベント数:', events.length);
    events.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.Name} - ${event.Status} - ${event.Interval_value}${event.Interval_field}`);
    });
    
    // 即座に期限切れメッセージを削除（テスト）
    console.log('\n7. 即座に期限切れメッセージを削除...');
    const [deleteResult] = await connection.execute(`
      DELETE FROM personal_messages 
      WHERE expires_at <= NOW()
    `);
    console.log(`✓ 削除されたメッセージ数: ${deleteResult.affectedRows}`);
    
  } catch (error) {
    console.error('エラー:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// スクリプト実行
fixMessageCleanup().catch(console.error);
