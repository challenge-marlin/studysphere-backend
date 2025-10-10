/**
 * lesson_text_video_linksテーブルの古いtext_file_keyを修正するスクリプト
 * レッスンファイルを更新（例：PDF→MD）した際に、lesson_text_video_linksの古いS3キーが残っている場合に実行
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/../backend/.env' });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shinomoto926!',
  database: process.env.DB_NAME || 'curriculum-portal',
  port: process.env.DB_PORT || 3306
};

async function fixLessonTextVideoLinks() {
  let connection;
  
  try {
    console.log('🔧 データベースに接続中...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ データベース接続成功');
    
    // 現在の状態を確認
    console.log('\n📊 現在の状態を確認中...');
    const [mismatchedRows] = await connection.execute(`
      SELECT 
        l.id as lesson_id,
        l.title as lesson_title,
        l.s3_key as current_lesson_s3_key,
        ltv.id as link_id,
        ltv.text_file_key as old_text_file_key,
        ltv.video_id
      FROM lessons l
      INNER JOIN lesson_text_video_links ltv ON l.id = ltv.lesson_id
      WHERE l.s3_key != ltv.text_file_key
      ORDER BY l.id, ltv.id
    `);
    
    if (mismatchedRows.length === 0) {
      console.log('✅ 不一致のレコードは見つかりませんでした。');
      await connection.end();
      return;
    }
    
    console.log(`\n⚠️  ${mismatchedRows.length}件の不一致レコードが見つかりました：`);
    console.table(mismatchedRows);
    
    // 更新を実行
    console.log('\n🔄 lesson_text_video_linksテーブルを更新中...');
    const [updateResult] = await connection.execute(`
      UPDATE lesson_text_video_links ltv
      INNER JOIN lessons l ON ltv.lesson_id = l.id
      SET ltv.text_file_key = l.s3_key,
          ltv.updated_at = CURRENT_TIMESTAMP
      WHERE l.s3_key != ltv.text_file_key
    `);
    
    console.log(`✅ ${updateResult.affectedRows}件のレコードを更新しました。`);
    
    // 存在しないS3キーを参照しているレコードを削除
    console.log('\n🗑️  孤立したレコードをクリーンアップ中...');
    const [deleteResult] = await connection.execute(`
      DELETE ltv
      FROM lesson_text_video_links ltv
      LEFT JOIN lessons l ON ltv.lesson_id = l.id AND ltv.text_file_key = l.s3_key
      WHERE l.id IS NULL
    `);
    
    if (deleteResult.affectedRows > 0) {
      console.log(`✅ ${deleteResult.affectedRows}件の孤立レコードを削除しました。`);
    } else {
      console.log('✅ 孤立レコードは見つかりませんでした。');
    }
    
    // 更新後の状態を確認
    console.log('\n📊 更新後の状態を確認中...');
    const [finalMismatchedRows] = await connection.execute(`
      SELECT 
        l.id as lesson_id,
        l.title as lesson_title,
        l.s3_key as current_lesson_s3_key,
        ltv.id as link_id,
        ltv.text_file_key as link_text_file_key
      FROM lessons l
      INNER JOIN lesson_text_video_links ltv ON l.id = ltv.lesson_id
      WHERE l.s3_key != ltv.text_file_key
      ORDER BY l.id, ltv.id
    `);
    
    if (finalMismatchedRows.length === 0) {
      console.log('✅ 全てのレコードが一致しています。修正完了！');
    } else {
      console.log(`⚠️  まだ${finalMismatchedRows.length}件の不一致レコードが残っています：`);
      console.table(finalMismatchedRows);
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
console.log('lesson_text_video_links修正スクリプト');
console.log('===========================================\n');

fixLessonTextVideoLinks()
  .then(() => {
    console.log('\n✅ 全ての処理が完了しました。');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });

