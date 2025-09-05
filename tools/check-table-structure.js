const { pool } = require('./backend/utils/database');

async function checkTableStructure() {
  const connection = await pool.getConnection();
  
  try {
    console.log('=== テーブル構造確認 ===');
    
    // 1. テーブル一覧の確認
    console.log('\n1. テーブル一覧:');
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('テーブル数:', tables.length);
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`  ${tableName}`);
    });
    
    // 2. user_accountsテーブルの構造確認
    console.log('\n2. user_accountsテーブルの構造:');
    try {
      const [columns] = await connection.execute('DESCRIBE user_accounts');
      columns.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`));
    } catch (error) {
      console.log('  user_accountsテーブルが存在しません');
    }
    
    // 3. usersテーブルの構造確認
    console.log('\n3. usersテーブルの構造:');
    try {
      const [columns] = await connection.execute('DESCRIBE users');
      columns.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`));
    } catch (error) {
      console.log('  usersテーブルが存在しません');
    }
    
    // 4. coursesテーブルの構造確認
    console.log('\n4. coursesテーブルの構造:');
    try {
      const [columns] = await connection.execute('DESCRIBE courses');
      columns.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`));
    } catch (error) {
      console.log('  coursesテーブルが存在しません');
    }
    
    // 5. lessonsテーブルの構造確認
    console.log('\n5. lessonsテーブルの構造:');
    try {
      const [columns] = await connection.execute('DESCRIBE lessons');
      columns.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`));
    } catch (error) {
      console.log('  lessonsテーブルが存在しません');
    }
    
    // 6. user_lesson_progressテーブルの構造確認
    console.log('\n6. user_lesson_progressテーブルの構造:');
    try {
      const [columns] = await connection.execute('DESCRIBE user_lesson_progress');
      columns.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`));
    } catch (error) {
      console.log('  user_lesson_progressテーブルが存在しません');
    }
    
    // 7. user_coursesテーブルの構造確認
    console.log('\n7. user_coursesテーブルの構造:');
    try {
      const [columns] = await connection.execute('DESCRIBE user_courses');
      columns.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`));
    } catch (error) {
      console.log('  user_coursesテーブルが存在しません');
    }
    
  } catch (error) {
    console.error('テーブル構造確認エラー:', error);
  } finally {
    connection.release();
    console.log('\n=== 確認完了 ===');
    process.exit(0);
  }
}

checkTableStructure();
