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

async function fixSatelliteAssignment() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('データベースに接続しました');

    // 拠点情報を取得
    const [satelliteRows] = await connection.execute(`
      SELECT id, name, company_id
      FROM satellites
      WHERE status = 1
      ORDER BY id
    `);

    console.log('=== 利用可能な拠点 ===');
    satelliteRows.forEach((satellite, index) => {
      console.log(`${index + 1}. ${satellite.name} (ID: ${satellite.id}, 企業ID: ${satellite.company_id})`);
    });

    // ロール1の利用者を取得
    const [userRows] = await connection.execute(`
      SELECT id, name, role, satellite_ids, status
      FROM user_accounts
      WHERE role = 1 AND status = 1
      ORDER BY id
    `);

    console.log(`\n=== ロール1利用者 (${userRows.length}名) ===`);
    userRows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (ID: ${user.id}) - satellite_ids: "${user.satellite_ids}"`);
    });

    // 利用者を拠点に割り当て
    console.log('\n=== 拠点割り当て開始 ===');
    
    for (let i = 0; i < userRows.length; i++) {
      const user = userRows[i];
      // 利用者を順番に拠点に割り当て（ラウンドロビン方式）
      const satelliteIndex = i % satelliteRows.length;
      const satellite = satelliteRows[satelliteIndex];
      
      console.log(`${user.name} (ID: ${user.id}) → ${satellite.name} (ID: ${satellite.id})`);
      
      // satellite_idsを更新
      await connection.execute(
        'UPDATE user_accounts SET satellite_ids = ? WHERE id = ?',
        [JSON.stringify([satellite.id]), user.id]
      );
    }

    console.log('\n=== 更新完了 ===');
    
    // 更新後の確認
    const [updatedUserRows] = await connection.execute(`
      SELECT id, name, role, satellite_ids, status
      FROM user_accounts
      WHERE role = 1 AND status = 1
      ORDER BY id
    `);

    console.log('=== 更新後の利用者 ===');
    updatedUserRows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (ID: ${user.id}) - satellite_ids: "${user.satellite_ids}"`);
      try {
        const parsed = JSON.parse(user.satellite_ids);
        console.log(`    パース結果: ${JSON.stringify(parsed)}`);
      } catch (error) {
        console.log(`    パースエラー: ${error.message}`);
      }
    });

    // 各拠点の利用者数を確認
    console.log('\n=== 拠点別利用者数確認 ===');
    for (const satellite of satelliteRows) {
      const [countRows] = await connection.execute(`
        SELECT COUNT(*) as count
        FROM user_accounts
        WHERE role = 1 
          AND satellite_ids IS NOT NULL 
          AND satellite_ids != 'null' 
          AND satellite_ids != '[]'
          AND satellite_ids != ''
          AND JSON_CONTAINS(satellite_ids, ?)
          AND status = 1
      `, [JSON.stringify(satellite.id)]);
      
      console.log(`${satellite.name}: ${countRows[0].count}名`);
    }

  } catch (error) {
    console.error('エラーが発生:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixSatelliteAssignment();
