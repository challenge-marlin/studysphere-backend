const { pool } = require('../backend/utils/database');
const { customLogger } = require('../backend/utils/logger');

async function fixLesson1VideoStatus() {
  const connection = await pool.getConnection();
  
  try {
    console.log('=== レッスン1の動画ステータス修正 ===');
    
    // レッスン1の動画情報を確認
    const [videoRows] = await connection.execute(`
      SELECT id, title, youtube_url, status, created_at, updated_at 
      FROM lesson_videos 
      WHERE lesson_id = 1
    `);
    
    console.log('レッスン1の動画情報:');
    videoRows.forEach((video, index) => {
      console.log(`${index + 1}. ID: ${video.id}`);
      console.log(`   タイトル: ${video.title}`);
      console.log(`   URL: ${video.youtube_url}`);
      console.log(`   ステータス: ${video.status}`);
      console.log(`   作成日: ${video.created_at}`);
      console.log(`   更新日: ${video.updated_at}`);
      console.log('');
    });
    
    // ステータスがdeletedの動画をactiveに変更
    const [updateResult] = await connection.execute(`
      UPDATE lesson_videos 
      SET status = 'active', updated_at = CURRENT_TIMESTAMP 
      WHERE lesson_id = 1 AND status = 'deleted'
    `);
    
    console.log(`✅ ${updateResult.affectedRows}件の動画ステータスを修正しました`);
    
    // 修正後の動画情報を確認
    const [updatedVideos] = await connection.execute(`
      SELECT id, title, youtube_url, status, updated_at 
      FROM lesson_videos 
      WHERE lesson_id = 1
    `);
    
    console.log('\n=== 修正後のレッスン1の動画情報 ===');
    updatedVideos.forEach((video, index) => {
      console.log(`${index + 1}. ${video.title}`);
      console.log(`   URL: ${video.youtube_url}`);
      console.log(`   ステータス: ${video.status}`);
      console.log(`   更新日: ${video.updated_at}`);
      console.log('');
    });
    
    // アクティブな動画数を確認
    const [activeVideos] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM lesson_videos 
      WHERE lesson_id = 1 AND status = 'active'
    `);
    
    console.log(`アクティブな動画数: ${activeVideos[0].count}件`);
    
    if (activeVideos[0].count > 0) {
      console.log('✅ レッスン1の動画が正常に復活しました！');
      console.log('フロントエンドを再読み込みすると動画が表示されるはずです。');
    } else {
      console.log('❌ アクティブな動画が見つかりません。');
    }
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    connection.release();
  }
}

fixLesson1VideoStatus();
