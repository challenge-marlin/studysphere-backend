const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'shinomoto926!',
  database: 'curriculum-portal',
  charset: 'utf8mb4'
};

async function checkManagerIds() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('データベースのmanager_idsフィールドの状態を確認中...\n');
    
    // 管理者情報が設定されている拠点を取得
    const [rows] = await connection.execute(`
      SELECT id, name, manager_ids 
      FROM satellites 
      WHERE manager_ids IS NOT NULL 
      ORDER BY id
    `);
    
    console.log(`管理者情報が設定されている拠点数: ${rows.length}\n`);
    
    rows.forEach((row, index) => {
      console.log(`拠点${index + 1}: ${row.name} (ID: ${row.id})`);
      console.log(`manager_ids (生データ): ${row.manager_ids}`);
      console.log(`manager_ids (型): ${typeof row.manager_ids}`);
      
      try {
        const parsed = JSON.parse(row.manager_ids);
        console.log(`manager_ids (パース後): ${JSON.stringify(parsed)}`);
        console.log(`manager_ids (配列か): ${Array.isArray(parsed)}`);
        console.log(`manager_ids (要素数): ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
      } catch (e) {
        console.log(`manager_ids (パースエラー): ${e.message}`);
      }
      
      console.log('---');
    });
    
    // 管理者情報が設定されていない拠点も確認
    const [nullRows] = await connection.execute(`
      SELECT id, name, manager_ids 
      FROM satellites 
      WHERE manager_ids IS NULL 
      ORDER BY id
    `);
    
    console.log(`管理者情報が設定されていない拠点数: ${nullRows.length}`);
    if (nullRows.length > 0) {
      console.log('管理者情報が設定されていない拠点:');
      nullRows.forEach(row => {
        console.log(`- ${row.name} (ID: ${row.id})`);
      });
    }
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// スクリプトを実行
checkManagerIds();
