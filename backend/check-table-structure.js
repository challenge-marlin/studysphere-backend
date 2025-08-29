const { pool } = require('./utils/database');

async function checkTableStructure() {
  let connection;
  try {
    console.log('=== user_accountsテーブル構造確認 ===');
    
    connection = await pool.getConnection();
    console.log('データベース接続取得成功');
    
    // テーブル構造を確認
    const [columns] = await connection.execute(`
      DESCRIBE user_accounts
    `);
    
    console.log('user_accountsテーブルのカラム一覧:');
    columns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // サンプルデータも確認
    const [sampleData] = await connection.execute(`
      SELECT * FROM user_accounts LIMIT 1
    `);
    
    console.log('\nサンプルデータのカラム:');
    if (sampleData.length > 0) {
      Object.keys(sampleData[0]).forEach(key => {
        console.log(`- ${key}: ${sampleData[0][key]}`);
      });
    }
    
  } catch (error) {
    console.error('テーブル構造確認エラー:', error.message);
  } finally {
    if (connection) {
      connection.release();
    }
  }
  
  process.exit(0);
}

checkTableStructure();
