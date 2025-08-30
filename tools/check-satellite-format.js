const mysql = require('mysql2/promise');

// データベース接続設定
const dbConfig = {
  host: 'localhost',
  port: 3307,
  user: 'root',
  password: 'shinomoto926!',
  database: 'curriculum-portal',
  charset: 'utf8mb4'
};

async function checkSatelliteFormat() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('データベースに接続しました');

    // ロール1の利用者のsatellite_idsを確認
    const [userRows] = await connection.execute(`
      SELECT id, name, role, satellite_ids, status
      FROM user_accounts
      WHERE role = 1 AND status = 1
      ORDER BY id
    `);

    console.log(`\n=== ロール1利用者のsatellite_ids形式確認 (${userRows.length}名) ===`);
    
    for (const user of userRows) {
      console.log(`\n${user.name} (ID: ${user.id}):`);
      console.log(`  元の値: "${user.satellite_ids}"`);
      console.log(`  型: ${typeof user.satellite_ids}`);
      console.log(`  長さ: ${user.satellite_ids ? user.satellite_ids.length : 'null'}`);
      
      if (user.satellite_ids) {
        try {
          const parsed = JSON.parse(user.satellite_ids);
          console.log(`  パース結果: ${JSON.stringify(parsed)}`);
          console.log(`  パース後の型: ${typeof parsed}`);
          console.log(`  配列かどうか: ${Array.isArray(parsed)}`);
          
          // JSON_CONTAINSでテスト
          const [testRows] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM user_accounts
            WHERE id = ? AND JSON_CONTAINS(satellite_ids, ?)
          `, [user.id, JSON.stringify(parsed[0] || parsed)]);
          
          console.log(`  JSON_CONTAINSテスト: ${testRows[0].count > 0 ? '成功' : '失敗'}`);
          
        } catch (error) {
          console.log(`  パースエラー: ${error.message}`);
        }
      } else {
        console.log(`  値がnullまたは空`);
      }
    }

    // 拠点情報も確認
    console.log('\n=== 拠点情報確認 ===');
    const [satelliteRows] = await connection.execute(`
      SELECT id, name, company_id
      FROM satellites
      WHERE status = 1
      ORDER BY id
    `);

    satelliteRows.forEach(satellite => {
      console.log(`拠点${satellite.id}: ${satellite.name} (企業ID: ${satellite.company_id})`);
    });

  } catch (error) {
    console.error('エラーが発生:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkSatelliteFormat();
