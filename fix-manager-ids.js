const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'shinomoto926!',
  database: 'curriculum-portal',
  charset: 'utf8mb4'
};

async function fixManagerIds() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('=== manager_ids フィールドの修正開始 ===\n');
    
    // すべての拠点のmanager_idsを確認
    const [rows] = await connection.execute(`
      SELECT id, name, manager_ids 
      FROM satellites 
      ORDER BY id
    `);
    
    console.log(`拠点総数: ${rows.length}\n`);
    
    let fixedCount = 0;
    
    for (const row of rows) {
      console.log(`拠点: ${row.name} (ID: ${row.id})`);
      console.log(`現在のmanager_ids: "${row.manager_ids}"`);
      
      let needsFix = false;
      let fixedValue = null;
      
      if (row.manager_ids) {
        try {
          // パースを試行
          const parsed = JSON.parse(row.manager_ids);
          console.log(`パース成功: ${JSON.stringify(parsed)}`);
          
          // 配列でない場合は配列に変換
          if (!Array.isArray(parsed)) {
            needsFix = true;
            fixedValue = JSON.stringify([parsed]);
            console.log(`配列に変換: ${fixedValue}`);
          }
        } catch (e) {
          console.log(`パースエラー: ${e.message}`);
          needsFix = true;
          
          // 不正な文字を除去してからパースを試行
          const cleanedStr = row.manager_ids.replace(/[^\x20-\x7E]/g, '');
          console.log(`クリーンアップ後: "${cleanedStr}"`);
          
          try {
            const cleanedParsed = JSON.parse(cleanedStr);
            if (Array.isArray(cleanedParsed)) {
              fixedValue = JSON.stringify(cleanedParsed);
            } else {
              fixedValue = JSON.stringify([cleanedParsed]);
            }
            console.log(`修正値: ${fixedValue}`);
          } catch (e2) {
            console.log(`クリーンアップ後もパース失敗: ${e2.message}`);
            // 空配列に設定
            fixedValue = JSON.stringify([]);
            console.log(`空配列に設定: ${fixedValue}`);
          }
        }
      } else {
        // NULLの場合は空配列に設定
        needsFix = true;
        fixedValue = JSON.stringify([]);
        console.log(`NULLを空配列に設定: ${fixedValue}`);
      }
      
      if (needsFix) {
        console.log(`修正を実行: ${row.manager_ids} -> ${fixedValue}`);
        
        await connection.execute(`
          UPDATE satellites 
          SET manager_ids = ?, updated_at = NOW()
          WHERE id = ?
        `, [fixedValue, row.id]);
        
        fixedCount++;
        console.log('修正完了');
      } else {
        console.log('修正不要');
      }
      
      console.log('---');
    }
    
    console.log(`\n=== 修正完了 ===`);
    console.log(`修正された拠点数: ${fixedCount}`);
    
    // 修正後の確認
    console.log('\n=== 修正後の確認 ===');
    const [updatedRows] = await connection.execute(`
      SELECT id, name, manager_ids 
      FROM satellites 
      ORDER BY id
    `);
    
    updatedRows.forEach(row => {
      console.log(`拠点: ${row.name} (ID: ${row.id})`);
      console.log(`修正後のmanager_ids: "${row.manager_ids}"`);
      
      if (row.manager_ids) {
        try {
          const parsed = JSON.parse(row.manager_ids);
          console.log(`パース確認: ${JSON.stringify(parsed)} (配列: ${Array.isArray(parsed)})`);
        } catch (e) {
          console.log(`パース確認エラー: ${e.message}`);
        }
      }
      console.log('---');
    });
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// スクリプトを実行
fixManagerIds();
