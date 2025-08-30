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

async function testSatelliteData() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('データベースに接続しました');

    // 拠点情報を確認
    const [satelliteRows] = await connection.execute(`
      SELECT id, name, company_id
      FROM satellites
      LIMIT 5
    `);

    console.log('=== 拠点情報確認 ===');
    satelliteRows.forEach((satellite, index) => {
      console.log(`拠点${index + 1}: ${satellite.name} (ID: ${satellite.id}, 企業ID: ${satellite.company_id})`);
    });

    // 各拠点に所属する利用者を確認
    for (const satellite of satelliteRows) {
      console.log(`\n=== 拠点「${satellite.name}」に所属する利用者 ===`);
      
      // 空でないsatellite_idsを持つ利用者を確認
      const [userRows] = await connection.execute(`
        SELECT id, name, role, satellite_ids, status
        FROM user_accounts
        WHERE role = 1 
          AND satellite_ids IS NOT NULL 
          AND satellite_ids != 'null' 
          AND satellite_ids != '[]'
          AND satellite_ids != ''
          AND JSON_CONTAINS(satellite_ids, ?)
          AND status = 1
      `, [JSON.stringify(satellite.id)]);

      console.log(`拠点ID ${satellite.id} に所属する利用者数: ${userRows.length}名`);
      
      userRows.forEach((user, index) => {
        console.log(`  利用者${index + 1}: ${user.name} (ID: ${user.id})`);
        console.log(`    satellite_ids: "${user.satellite_ids}"`);
        try {
          const parsed = JSON.parse(user.satellite_ids);
          console.log(`    パース結果: ${JSON.stringify(parsed)}`);
        } catch (error) {
          console.log(`    パースエラー: ${error.message}`);
        }
      });
    }

    // 全利用者のsatellite_idsの状態を確認
    console.log('\n=== 全利用者のsatellite_ids状態確認 ===');
    const [allUserRows] = await connection.execute(`
      SELECT 
        role,
        COUNT(*) as total_count,
        COUNT(CASE WHEN satellite_ids IS NULL OR satellite_ids = 'null' OR satellite_ids = '[]' OR satellite_ids = '' THEN 1 END) as empty_count,
        COUNT(CASE WHEN satellite_ids IS NOT NULL AND satellite_ids != 'null' AND satellite_ids != '[]' AND satellite_ids != '' THEN 1 END) as has_data_count
      FROM user_accounts
      GROUP BY role
    `);

    allUserRows.forEach(row => {
      console.log(`ロール${row.role}: 総数${row.total_count}名, 空${row.empty_count}名, データあり${row.has_data_count}名`);
    });

  } catch (error) {
    console.error('エラーが発生:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testSatelliteData();
