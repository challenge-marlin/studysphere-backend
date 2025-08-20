const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'shinomoto926!',
  database: 'curriculum-portal',
  charset: 'utf8mb4'
};

async function debugManagerIds() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('=== manager_ids フィールドの詳細デバッグ ===\n');
    
    // すべての拠点のmanager_idsを確認
    const [rows] = await connection.execute(`
      SELECT id, name, manager_ids 
      FROM satellites 
      ORDER BY id
    `);
    
    console.log(`拠点総数: ${rows.length}\n`);
    
    rows.forEach((row, index) => {
      console.log(`拠点${index + 1}: ${row.name} (ID: ${row.id})`);
      console.log(`manager_ids (生データ): "${row.manager_ids}"`);
      console.log(`manager_ids (型): ${typeof row.manager_ids}`);
      console.log(`manager_ids (長さ): ${row.manager_ids ? row.manager_ids.length : 'N/A'}`);
      
      if (row.manager_ids) {
        // 各文字のASCIIコードを確認
        console.log(`manager_ids (ASCII): ${Array.from(row.manager_ids).map(c => c.charCodeAt(0)).join(', ')}`);
        
        try {
          const parsed = JSON.parse(row.manager_ids);
          console.log(`manager_ids (パース成功): ${JSON.stringify(parsed)}`);
          console.log(`manager_ids (配列か): ${Array.isArray(parsed)}`);
          console.log(`manager_ids (要素数): ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
        } catch (e) {
          console.log(`manager_ids (パースエラー): ${e.message}`);
          
          // 不正な文字を特定
          const invalidChars = [];
          for (let i = 0; i < row.manager_ids.length; i++) {
            const char = row.manager_ids[i];
            const code = char.charCodeAt(0);
            if (code < 32 || code > 126) {
              invalidChars.push(`位置${i}: '${char}' (ASCII: ${code})`);
            }
          }
          if (invalidChars.length > 0) {
            console.log(`manager_ids (不正な文字): ${invalidChars.join(', ')}`);
          }
        }
      } else {
        console.log(`manager_ids: NULL`);
      }
      
      console.log('---');
    });
    
    // 問題のあるデータを特定
    console.log('\n=== 問題のあるデータの特定 ===');
    const problematicRows = rows.filter(row => {
      if (!row.manager_ids) return false;
      try {
        JSON.parse(row.manager_ids);
        return false;
      } catch (e) {
        return true;
      }
    });
    
    if (problematicRows.length > 0) {
      console.log(`問題のあるデータ数: ${problematicRows.length}`);
      problematicRows.forEach(row => {
        console.log(`拠点ID ${row.id}: "${row.manager_ids}"`);
      });
    } else {
      console.log('問題のあるデータは見つかりませんでした');
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
debugManagerIds();
