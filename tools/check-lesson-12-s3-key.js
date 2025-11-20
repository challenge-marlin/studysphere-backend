/**
 * レッスンID 12のS3キー不一致を確認するスクリプト
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/../backend/.env' });

// dotenvを使わずに直接設定
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shinomoto926!',
  database: process.env.DB_NAME || 'curriculum-portal',
  port: process.env.DB_PORT || 3306
};

async function checkLesson12() {
  let connection;
  
  try {
    console.log('🔧 データベースに接続中...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ データベース接続成功\n');
    
    // レッスンID 12の情報を取得
    console.log('📊 レッスンID 12の情報を確認中...\n');
    const [lessons] = await connection.execute(`
      SELECT 
        l.id,
        l.title,
        l.s3_key,
        l.file_type,
        c.title as course_title
      FROM lessons l
      LEFT JOIN courses c ON l.course_id = c.id
      WHERE l.id = 12 AND l.status != 'deleted'
    `);
    
    if (lessons.length === 0) {
      console.log('❌ レッスンID 12が見つかりません');
      return;
    }
    
    const lesson = lessons[0];
    console.log('--- レッスン情報 ---');
    console.log(`ID: ${lesson.id}`);
    console.log(`タイトル: ${lesson.title}`);
    console.log(`コース: ${lesson.course_title}`);
    console.log(`s3_key: ${lesson.s3_key}`);
    console.log(`file_type: ${lesson.file_type}\n`);
    
    // lesson_text_video_linksのtext_file_keyを確認
    console.log('📊 lesson_text_video_linksのtext_file_keyを確認中...\n');
    const [links] = await connection.execute(`
      SELECT 
        ltv.id,
        ltv.lesson_id,
        ltv.text_file_key,
        ltv.video_id,
        ltv.link_order,
        l.s3_key as lesson_s3_key,
        l.title as lesson_title,
        CASE 
          WHEN ltv.text_file_key = l.s3_key THEN '一致'
          WHEN ltv.text_file_key NOT LIKE 'lessons/%' THEN '不正なパス'
          ELSE '不一致'
        END as status
      FROM lesson_text_video_links ltv
      LEFT JOIN lessons l ON ltv.lesson_id = l.id
      WHERE ltv.lesson_id = 12
      ORDER BY ltv.link_order ASC
    `);
    
    console.log(`レッスンID 12のセクション数: ${links.length}\n`);
    
    if (links.length > 0) {
      console.log('--- セクション情報 ---');
      links.forEach((link, index) => {
        console.log(`\nセクション ${index + 1}:`);
        console.log(`  LinkID: ${link.id}`);
        console.log(`  text_file_key: ${link.text_file_key}`);
        console.log(`  lesson.s3_key: ${link.lesson_s3_key}`);
        console.log(`  ステータス: ${link.status}`);
        console.log(`  video_id: ${link.video_id}`);
        console.log(`  link_order: ${link.link_order}`);
        
        if (link.status !== '一致') {
          console.log(`  ⚠️  不一致が検出されました！`);
          console.log(`  修正が必要: text_file_keyを "${link.lesson_s3_key}" に更新`);
        }
      });
    } else {
      console.log('📝 レッスンID 12のセクションデータがありません。');
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
console.log('レッスンID 12のS3キー確認スクリプト');
console.log('===========================================\n');

checkLesson12()
  .then(() => {
    console.log('\n✅ 確認が完了しました。');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });

