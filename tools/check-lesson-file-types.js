const mysql = require('mysql2/promise');
const { dbConfig } = require('./backend/config/database');

async function checkLessonFileTypes() {
  let connection;
  
  try {
    // データベース接続
    connection = await mysql.createConnection(dbConfig);
    console.log('データベースに接続しました');

    // レッスン3のファイルタイプを確認
    const [lessons] = await connection.execute(`
      SELECT 
        id,
        title,
        s3_key,
        file_type,
        CASE 
          WHEN s3_key LIKE '%.pdf' THEN 'pdf'
          WHEN s3_key LIKE '%.md' THEN 'md'
          WHEN s3_key LIKE '%.txt' THEN 'txt'
          ELSE 'unknown'
        END as actual_extension,
        CASE 
          WHEN (s3_key LIKE '%.pdf' AND (file_type = 'pdf' OR file_type = 'application/pdf')) THEN '一致 ✓'
          WHEN (s3_key LIKE '%.md' AND file_type = 'md') THEN '一致 ✓'
          WHEN (s3_key LIKE '%.txt' AND file_type = 'text/plain') THEN '一致 ✓'
          ELSE '不一致 ✗'
        END as status
      FROM lessons
      WHERE id = 3 OR s3_key LIKE '%AI の基本概念%'
      ORDER BY id
    `);

    console.log('\n=== レッスン3のファイルタイプ状況 ===');
    lessons.forEach(lesson => {
      console.log(`ID: ${lesson.id}`);
      console.log(`タイトル: ${lesson.title}`);
      console.log(`S3キー: ${lesson.s3_key}`);
      console.log(`現在のfile_type: ${lesson.file_type}`);
      console.log(`実際の拡張子: ${lesson.actual_extension}`);
      console.log(`状況: ${lesson.status}`);
      console.log('---');
    });

    // MDファイルでfile_typeが間違っているレッスンを修正
    console.log('\n=== MDファイルのfile_typeを修正 ===');
    const [updateResult] = await connection.execute(`
      UPDATE lessons
      SET file_type = 'md',
          updated_at = CURRENT_TIMESTAMP
      WHERE status != 'deleted'
          AND s3_key LIKE '%.md'
          AND file_type != 'md'
    `);

    console.log(`修正完了: ${updateResult.affectedRows}件のレッスンを更新しました`);

    // 修正後の確認
    const [updatedLessons] = await connection.execute(`
      SELECT 
        id,
        title,
        s3_key,
        file_type
      FROM lessons
      WHERE id = 3 OR s3_key LIKE '%AI の基本概念%'
      ORDER BY id
    `);

    console.log('\n=== 修正後の状況 ===');
    updatedLessons.forEach(lesson => {
      console.log(`ID: ${lesson.id} - ${lesson.title}`);
      console.log(`  S3キー: ${lesson.s3_key}`);
      console.log(`  file_type: ${lesson.file_type}`);
    });

  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nデータベース接続を閉じました');
    }
  }
}

// スクリプト実行
if (require.main === module) {
  checkLessonFileTypes().catch(console.error);
}

module.exports = { checkLessonFileTypes };
