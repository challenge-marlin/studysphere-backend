const { pool } = require('./utils/database');

async function checkCompanies() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute('SELECT * FROM companies ORDER BY id');
    
    console.log('=== Companies テーブルの内容 ===');
    console.log('ID | 名前 | 作成日時');
    console.log('---|------|----------');
    
    rows.forEach(row => {
      console.log(`${row.id} | ${row.name} | ${row.created_at}`);
    });
    
    console.log(`\n合計: ${rows.length}件`);
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

checkCompanies();
