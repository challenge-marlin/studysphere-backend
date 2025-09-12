#!/usr/bin/env node

/**
 * メッセージの有効期限とイベントスケジューラーの状態を確認するスクリプト
 */

const mysql = require('mysql2/promise');

// データベース設定を直接指定
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shinomoto926!',
  database: process.env.DB_NAME || 'curriculum-portal',
  port: process.env.DB_PORT || 3307, // Docker環境では3307を使用
  charset: 'utf8mb4',
  ssl: false
};

async function checkMessageExpiration() {
  console.log('=== メッセージ有効期限チェック開始 ===');
  
  let connection;
  
  try {
    // データベース接続
    console.log('\n1. データベース接続...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ データベース接続成功');
    
    // 現在時刻を確認
    console.log('\n2. 現在時刻確認...');
    const [nowRows] = await connection.execute('SELECT NOW()');
    console.log('✓ 現在時刻:', nowRows[0]['NOW()']);
    
    // イベントスケジューラーの状態確認
    console.log('\n3. イベントスケジューラー状態確認...');
    const [eventSchedulerRows] = await connection.execute('SHOW VARIABLES LIKE "event_scheduler"');
    console.log('✓ イベントスケジューラー:', eventSchedulerRows[0].Value);
    
    // イベント一覧確認
    console.log('\n4. イベント一覧確認...');
    const [events] = await connection.execute('SHOW EVENTS');
    console.log('✓ イベント数:', events.length);
    events.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.Name} - ${event.Status} - ${event.Event_definition}`);
    });
    
    // 個人メッセージの有効期限確認
    console.log('\n5. 個人メッセージの有効期限確認...');
    const [messageRows] = await connection.execute(`
      SELECT 
        id,
        sender_id,
        receiver_id,
        message,
        created_at,
        expires_at,
        CASE 
          WHEN expires_at > NOW() THEN '有効'
          ELSE '期限切れ'
        END as status
      FROM personal_messages 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log('✓ 個人メッセージ数:', messageRows.length);
    messageRows.forEach((msg, index) => {
      console.log(`  ${index + 1}. ID:${msg.id} - ${msg.status} - 作成:${msg.created_at} - 期限:${msg.expires_at}`);
    });
    
    // 期限切れメッセージの数確認
    console.log('\n6. 期限切れメッセージ数確認...');
    const [expiredRows] = await connection.execute(`
      SELECT COUNT(*) as expired_count
      FROM personal_messages 
      WHERE expires_at <= NOW()
    `);
    console.log('✓ 期限切れメッセージ数:', expiredRows[0].expired_count);
    
    // 手動で期限切れメッセージを削除（テスト用）
    if (expiredRows[0].expired_count > 0) {
      console.log('\n7. 手動で期限切れメッセージを削除...');
      const [deleteResult] = await connection.execute(`
        DELETE FROM personal_messages 
        WHERE expires_at <= NOW()
      `);
      console.log(`✓ 削除されたメッセージ数: ${deleteResult.affectedRows}`);
    }
    
  } catch (error) {
    console.error('エラー:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// スクリプト実行
checkMessageExpiration().catch(console.error);
