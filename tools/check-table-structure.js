const { pool } = require('./backend/utils/database');

async function checkTableStructure() {
  try {
    console.log('=== テーブル構造確認 ===');
    
    // remote_support_daily_recordsテーブルの構造を確認
    const [columns] = await pool.execute(`
      DESCRIBE remote_support_daily_records
    `);
    
    console.log('remote_support_daily_recordsテーブルのカラム:');
    columns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // instructor_commentフィールドの存在確認
    const hasInstructorComment = columns.some(col => col.Field === 'instructor_comment');
    console.log(`\ninstructor_commentフィールドの存在: ${hasInstructorComment ? 'あり' : 'なし'}`);
    
    if (!hasInstructorComment) {
      console.log('\n=== instructor_commentフィールドを追加します ===');
      await pool.execute(`
        ALTER TABLE remote_support_daily_records 
        ADD COLUMN instructor_comment JSON DEFAULT NULL COMMENT '指導員コメント（JSON形式）' 
        AFTER advice
      `);
      console.log('instructor_commentフィールドを追加しました');
    }
    
    // サンプルデータの確認
    const [sampleData] = await pool.execute(`
      SELECT COUNT(*) as count FROM remote_support_daily_records
    `);
    console.log(`\n日報データ件数: ${sampleData[0].count}件`);
    
    if (sampleData[0].count > 0) {
      const [sampleRecord] = await pool.execute(`
        SELECT * FROM remote_support_daily_records LIMIT 1
      `);
      console.log('\nサンプルレコード:');
      console.log(JSON.stringify(sampleRecord[0], null, 2));
    }
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await pool.end();
  }
}

checkTableStructure();
