/**
 * レッスンのS3キーを確認するスクリプト
 * 問題のあるS3キー（ファイル名のみ、パスが不完全など）を検出
 */

const mysql = require('mysql2/promise');

// dotenvを使わずに直接設定
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shinomoto926!',
  database: process.env.DB_NAME || 'curriculum-portal',
  port: process.env.DB_PORT || 3306
};

async function checkLessonS3Keys() {
  let connection;
  
  try {
    console.log('🔧 データベースに接続中...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ データベース接続成功\n');
    
    // 全レッスンのS3キーを取得
    console.log('📊 レッスンのS3キーを確認中...\n');
    const [lessons] = await connection.execute(`
      SELECT 
        l.id,
        l.title,
        l.s3_key,
        l.file_type,
        c.title as course_title,
        CASE 
          WHEN l.s3_key IS NULL THEN 'キーなし'
          WHEN l.s3_key NOT LIKE 'lessons/%' THEN '不正なパス'
          WHEN l.s3_key LIKE 'lessons/%/%/%.pdf' OR l.s3_key LIKE 'lessons/%/%/%.md' THEN '正常'
          ELSE '要確認'
        END as status
      FROM lessons l
      LEFT JOIN courses c ON l.course_id = c.id
      WHERE l.status != 'deleted'
      ORDER BY l.id
    `);
    
    console.log(`全レッスン数: ${lessons.length}\n`);
    
    // 問題のあるレッスンをフィルタリング
    const problematicLessons = lessons.filter(l => l.status !== '正常' && l.status !== 'キーなし');
    
    if (problematicLessons.length > 0) {
      console.log(`⚠️  問題のあるS3キーが${problematicLessons.length}件見つかりました：\n`);
      console.table(problematicLessons.map(l => ({
        'ID': l.id,
        'レッスン': l.title?.substring(0, 30) || 'N/A',
        'S3キー': l.s3_key?.substring(0, 50) || 'N/A',
        'ファイルタイプ': l.file_type || 'N/A',
        'ステータス': l.status
      })));
      
      console.log('\n詳細情報：');
      problematicLessons.forEach(l => {
        console.log(`\n--- レッスンID: ${l.id} ---`);
        console.log(`タイトル: ${l.title}`);
        console.log(`コース: ${l.course_title}`);
        console.log(`現在のS3キー: ${l.s3_key}`);
        console.log(`ファイルタイプ: ${l.file_type}`);
        
        // 期待されるS3キーを生成
        if (l.s3_key && l.course_title && l.title) {
          const fileName = l.s3_key.split('/').pop();
          const expectedS3Key = `lessons/${l.course_title}/${l.title}/${fileName}`;
          console.log(`期待されるS3キー: ${expectedS3Key}`);
        }
      });
    } else {
      console.log('✅ 全てのレッスンのS3キーが正常です。');
    }
    
    // キーなしのレッスンも表示
    const lessonsWithoutKey = lessons.filter(l => l.status === 'キーなし');
    if (lessonsWithoutKey.length > 0) {
      console.log(`\n📝 S3キーが設定されていないレッスン: ${lessonsWithoutKey.length}件`);
      console.table(lessonsWithoutKey.map(l => ({
        'ID': l.id,
        'レッスン': l.title?.substring(0, 40) || 'N/A',
        'コース': l.course_title?.substring(0, 30) || 'N/A'
      })));
    }
    
    // lesson_text_video_linksのtext_file_keyも確認
    console.log('\n\n📊 lesson_text_video_linksのtext_file_keyを確認中...\n');
    const [links] = await connection.execute(`
      SELECT 
        ltv.id,
        ltv.lesson_id,
        ltv.text_file_key,
        l.s3_key as lesson_s3_key,
        l.title as lesson_title,
        CASE 
          WHEN ltv.text_file_key = l.s3_key THEN '一致'
          WHEN ltv.text_file_key NOT LIKE 'lessons/%' THEN '不正なパス'
          ELSE '不一致'
        END as status
      FROM lesson_text_video_links ltv
      LEFT JOIN lessons l ON ltv.lesson_id = l.id
    `);
    
    const problematicLinks = links.filter(l => l.status !== '一致');
    
    if (problematicLinks.length > 0) {
      console.log(`⚠️  問題のあるtext_file_keyが${problematicLinks.length}件見つかりました：\n`);
      console.table(problematicLinks.map(l => ({
        'LinkID': l.id,
        'レッスンID': l.lesson_id,
        'text_file_key': l.text_file_key?.substring(0, 40) || 'N/A',
        '現在のlesson.s3_key': l.lesson_s3_key?.substring(0, 40) || 'N/A',
        'ステータス': l.status
      })));
    } else if (links.length > 0) {
      console.log('✅ 全てのtext_file_keyが正常です。');
    } else {
      console.log('📝 lesson_text_video_linksにレコードがありません。');
    }
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 データベース接続を閉じました。');
    }
  }
}

// スクリプトを実行
console.log('===========================================');
console.log('レッスンS3キー確認スクリプト');
console.log('===========================================\n');

checkLessonS3Keys()
  .then(() => {
    console.log('\n✅ 全ての処理が完了しました。');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });

