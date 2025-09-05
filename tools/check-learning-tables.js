const { pool } = require('./utils/database');

const checkLearningTables = async () => {
  const connection = await pool.getConnection();
  
  try {
    console.log('=== 学習関連テーブルの存在確認 ===');
    
    // 必要なテーブルのリスト
    const requiredTables = [
      'courses',
      'lessons', 
      'lesson_videos',
      'lesson_text_video_links',
      'user_courses',
      'user_lesson_progress'
    ];
    
    for (const tableName of requiredTables) {
      try {
        const [result] = await connection.execute(`SHOW TABLES LIKE '${tableName}'`);
        if (result.length > 0) {
          console.log(`✅ ${tableName}: 存在します`);
          
          // テーブルの構造も確認
          const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
          console.log(`   カラム数: ${columns.length}`);
          
          // サンプルデータも確認
          const [sampleData] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
          console.log(`   データ数: ${sampleData[0].count}`);
        } else {
          console.log(`❌ ${tableName}: 存在しません`);
        }
      } catch (error) {
        console.log(`❌ ${tableName}: エラー - ${error.message}`);
      }
    }
    
    // レッスンID 1のデータを確認
    console.log('\n=== レッスンID 1のデータ確認 ===');
    try {
      const [lessonData] = await connection.execute(`
        SELECT l.*, c.title as course_title 
        FROM lessons l 
        JOIN courses c ON l.course_id = c.id 
        WHERE l.id = 1
      `);
      
      if (lessonData.length > 0) {
        console.log('✅ レッスンID 1のデータが存在します');
        console.log('   レッスン情報:', lessonData[0]);
      } else {
        console.log('❌ レッスンID 1のデータが存在しません');
      }
    } catch (error) {
      console.log(`❌ レッスンID 1の確認でエラー: ${error.message}`);
    }
    
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
  } finally {
    connection.release();
  }
};

checkLearningTables();
