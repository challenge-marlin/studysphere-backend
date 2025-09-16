const mysql = require('mysql2/promise');
const { dbConfig } = require('../config/database');

/**
 * ファイルタイプを修正するスクリプト
 * S3キーの拡張子に基づいてfile_typeを正しく設定する
 */

async function fixFileTypes() {
  let connection;
  
  try {
    // データベース接続
    connection = await mysql.createConnection(dbConfig);

    console.log('データベースに接続しました');

    // 現在のレッスンデータを取得
    const [lessons] = await connection.execute(`
      SELECT id, title, s3_key, file_type 
      FROM lessons 
      WHERE s3_key IS NOT NULL AND status != 'deleted'
      ORDER BY id
    `);

    console.log(`修正対象のレッスン数: ${lessons.length}`);

    // ファイルタイプマッピング
    const fileTypeMap = {
      'pdf': 'pdf',
      'md': 'md',
      'txt': 'text/plain',
      'rtf': 'application/rtf',
      'docx': 'docx',
      'pptx': 'pptx'
    };

    let updateCount = 0;

    for (const lesson of lessons) {
      if (!lesson.s3_key) continue;

      // S3キーからファイル名を抽出
      const fileName = lesson.s3_key.split('/').pop();
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      
      if (!fileExtension) continue;

      // 正しいファイルタイプを決定
      const correctFileType = fileTypeMap[fileExtension] || 'pdf';
      
      // 現在のfile_typeと異なる場合のみ更新
      if (lesson.file_type !== correctFileType) {
        console.log(`レッスンID ${lesson.id}: "${lesson.title}"`);
        console.log(`  S3キー: ${lesson.s3_key}`);
        console.log(`  現在のfile_type: ${lesson.file_type}`);
        console.log(`  正しいfile_type: ${correctFileType}`);
        
        await connection.execute(`
          UPDATE lessons 
          SET file_type = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [correctFileType, lesson.id]);
        
        updateCount++;
        console.log(`  → 更新完了\n`);
      }
    }

    console.log(`修正完了: ${updateCount}件のレッスンを更新しました`);

  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('データベース接続を閉じました');
    }
  }
}

// スクリプト実行
if (require.main === module) {
  fixFileTypes().catch(console.error);
}

module.exports = { fixFileTypes };
