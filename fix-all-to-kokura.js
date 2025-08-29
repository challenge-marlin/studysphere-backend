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

async function fixAllToKokura() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('データベースに接続しました');

    // 小倉BASEの情報を取得
    const [satelliteRows] = await connection.execute(`
      SELECT id, name, company_id
      FROM satellites
      WHERE name LIKE '%小倉%' AND status = 1
      LIMIT 1
    `);

    if (satelliteRows.length === 0) {
      console.log('小倉BASEが見つかりません');
      return;
    }

    const kokuraSatellite = satelliteRows[0];
    console.log(`小倉BASE: ${kokuraSatellite.name} (ID: ${kokuraSatellite.id})`);

    // ロール1の利用者を取得
    const [userRows] = await connection.execute(`
      SELECT id, name, role, satellite_ids, status
      FROM user_accounts
      WHERE role = 1 AND status = 1
      ORDER BY id
    `);

    console.log(`\n=== ロール1利用者 (${userRows.length}名) ===`);
    userRows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (ID: ${user.id}) - 現在のsatellite_ids: "${user.satellite_ids}"`);
    });

    // 全利用者を小倉BASEに所属させる
    console.log('\n=== 全利用者を小倉BASEに所属させる ===');
    
    for (const user of userRows) {
      console.log(`${user.name} (ID: ${user.id}) → 小倉BASE (ID: ${kokuraSatellite.id})`);
      
      // satellite_idsを小倉BASEのIDの配列に更新
      await connection.execute(
        'UPDATE user_accounts SET satellite_ids = ? WHERE id = ?',
        [JSON.stringify([kokuraSatellite.id]), user.id]
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

    // 小倉BASEの利用者数を確認
    console.log('\n=== 小倉BASEの利用者数確認 ===');
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
    `, [JSON.stringify(kokuraSatellite.id)]);
    
    console.log(`小倉BASE: ${countRows[0].count}名`);

    // 他の拠点の利用者数も確認
    console.log('\n=== 他の拠点の利用者数確認 ===');
    const [otherSatelliteRows] = await connection.execute(`
      SELECT id, name
      FROM satellites
      WHERE id != ? AND status = 1
      ORDER BY id
    `, [kokuraSatellite.id]);

    for (const satellite of otherSatelliteRows) {
      const [otherCountRows] = await connection.execute(`
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
      
      console.log(`${satellite.name}: ${otherCountRows[0].count}名`);
    }

  } catch (error) {
    console.error('エラーが発生:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixAllToKokura();
