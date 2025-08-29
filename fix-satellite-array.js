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

async function fixSatelliteArray() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('データベースに接続しました');

    // ロール1の利用者を取得
    const [userRows] = await connection.execute(`
      SELECT id, name, role, satellite_ids, status
      FROM user_accounts
      WHERE role = 1 AND status = 1
      ORDER BY id
    `);

    console.log('=== 修正前の利用者 ===');
    userRows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (ID: ${user.id}) - satellite_ids: "${user.satellite_ids}"`);
    });

    // satellite_idsを正しいJSON配列形式に修正
    console.log('\n=== 配列形式に修正開始 ===');
    
    for (const user of userRows) {
      let satelliteIds = [];
      
      if (user.satellite_ids) {
        try {
          // 既に配列の場合はそのまま
          if (Array.isArray(user.satellite_ids)) {
            satelliteIds = user.satellite_ids;
          }
          // 文字列の場合はパースを試行
          else if (typeof user.satellite_ids === 'string') {
            const parsed = JSON.parse(user.satellite_ids);
            satelliteIds = Array.isArray(parsed) ? parsed : [parsed];
          }
          // 数値の場合は配列に変換
          else if (typeof user.satellite_ids === 'number') {
            satelliteIds = [user.satellite_ids];
          }
        } catch (error) {
          console.log(`パースエラー (${user.name}): ${error.message}`);
          // パースに失敗した場合は数値として扱う
          const numValue = parseInt(user.satellite_ids);
          if (!isNaN(numValue)) {
            satelliteIds = [numValue];
          }
        }
      }
      
      if (satelliteIds.length > 0) {
        console.log(`${user.name} (ID: ${user.id}): ${user.satellite_ids} → [${satelliteIds.join(', ')}]`);
        
        // satellite_idsを正しいJSON配列形式で更新
        await connection.execute(
          'UPDATE user_accounts SET satellite_ids = ? WHERE id = ?',
          [JSON.stringify(satelliteIds), user.id]
        );
      }
    }

    console.log('\n=== 修正完了 ===');
    
    // 修正後の確認
    const [updatedUserRows] = await connection.execute(`
      SELECT id, name, role, satellite_ids, status
      FROM user_accounts
      WHERE role = 1 AND status = 1
      ORDER BY id
    `);

    console.log('=== 修正後の利用者 ===');
    updatedUserRows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (ID: ${user.id}) - satellite_ids: "${user.satellite_ids}"`);
      try {
        const parsed = JSON.parse(user.satellite_ids);
        console.log(`    パース結果: ${JSON.stringify(parsed)} (型: ${typeof parsed}, 配列: ${Array.isArray(parsed)})`);
      } catch (error) {
        console.log(`    パースエラー: ${error.message}`);
      }
    });

    // 各拠点の利用者数を確認
    console.log('\n=== 拠点別利用者数確認 ===');
    const [satelliteRows] = await connection.execute(`
      SELECT id, name
      FROM satellites
      WHERE status = 1
      ORDER BY id
    `);

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

fixSatelliteArray();
