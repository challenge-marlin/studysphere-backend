const mysql = require('mysql2/promise');

async function testDatabaseConnection() {
  let connection;
  
  try {
    console.log('=== データベース接続テスト ===');
    
    // データベース設定
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'shinomoto926!',
      database: process.env.DB_NAME || 'curriculum-portal',
      port: process.env.DB_PORT || 3307,
    };
    
    console.log('接続設定:', {
      host: dbConfig.host,
      user: dbConfig.user,
      database: dbConfig.database,
      port: dbConfig.port
    });
    
    // 接続テスト
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ データベース接続成功');
    
    // テーブル存在確認
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'remote_support_daily_records'
    `);
    
    if (tables.length > 0) {
      console.log('✅ remote_support_daily_recordsテーブルが存在します');
      
      // テーブル構造確認
      const [columns] = await connection.execute(`
        DESCRIBE remote_support_daily_records
      `);
      
      console.log('\nテーブル構造:');
      columns.forEach(col => {
        console.log(`- ${col.Field}: ${col.Type}`);
      });
      
      // instructor_commentフィールドの存在確認
      const hasInstructorComment = columns.some(col => col.Field === 'instructor_comment');
      console.log(`\ninstructor_commentフィールド: ${hasInstructorComment ? '✅ 存在' : '❌ 不存在'}`);
      
      if (!hasInstructorComment) {
        console.log('\n=== instructor_commentフィールドを追加 ===');
        await connection.execute(`
          ALTER TABLE remote_support_daily_records 
          ADD COLUMN instructor_comment JSON DEFAULT NULL COMMENT '指導員コメント（JSON形式）' 
          AFTER advice
        `);
        console.log('✅ instructor_commentフィールドを追加しました');
      }
      
      // サンプルデータ確認
      const [countResult] = await connection.execute(`
        SELECT COUNT(*) as count FROM remote_support_daily_records
      `);
      console.log(`\n日報データ件数: ${countResult[0].count}件`);
      
    } else {
      console.log('❌ remote_support_daily_recordsテーブルが存在しません');
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error('エラー詳細:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nデータベース接続を閉じました');
    }
  }
}

testDatabaseConnection();
