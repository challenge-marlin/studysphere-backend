const mysql = require('mysql2/promise');

// データベース接続設定
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'shinomoto926!',
  database: 'curriculum-portal',
  charset: 'utf8mb4'
};

async function setMorinaiAsManager() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('データベースに接続しました');

    // 盛内稔史さんのユーザーIDを検索
    const [userRows] = await connection.execute(
      'SELECT id, name, role, satellite_ids FROM user_accounts WHERE name LIKE ?',
      ['%盛内%']
    );

    if (userRows.length === 0) {
      console.log('盛内稔史さんが見つかりません');
      return;
    }

    const user = userRows[0];
    console.log('盛内稔史さんの情報:', user);

    // 盛内稔史さんが所属する拠点を取得
    let satelliteIds = [];
    if (user.satellite_ids) {
      try {
        satelliteIds = JSON.parse(user.satellite_ids);
      } catch (error) {
        console.error('satellite_idsのパースエラー:', error);
        return;
      }
    }

    if (satelliteIds.length === 0) {
      console.log('盛内稔史さんが所属する拠点が見つかりません');
      return;
    }

    console.log('所属拠点IDs:', satelliteIds);

    // 各拠点で管理者として設定
    for (const satelliteId of satelliteIds) {
      // 拠点情報を取得
      const [satelliteRows] = await connection.execute(
        'SELECT id, name, manager_ids FROM satellites WHERE id = ?',
        [satelliteId]
      );

      if (satelliteRows.length === 0) {
        console.log(`拠点ID ${satelliteId} が見つかりません`);
        continue;
      }

      const satellite = satelliteRows[0];
      console.log(`拠点 "${satellite.name}" の処理を開始`);

      let managerIds = [];
      if (satellite.manager_ids) {
        try {
          managerIds = JSON.parse(satellite.manager_ids);
        } catch (error) {
          console.error('manager_idsのパースエラー:', error);
          managerIds = [];
        }
      }

      // 既に管理者として設定されているかチェック
      if (managerIds.includes(user.id)) {
        console.log(`拠点 "${satellite.name}" は既に管理者として設定されています`);
        continue;
      }

      // 管理者として追加
      managerIds.push(user.id);
      const managerIdsJson = JSON.stringify(managerIds);

      await connection.execute(`
        UPDATE satellites 
        SET manager_ids = ?, updated_at = NOW()
        WHERE id = ?
      `, [managerIdsJson, satellite.id]);

      console.log(`拠点 "${satellite.name}" に管理者として設定しました`);
    }

    console.log('管理者設定が完了しました');

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// スクリプトを実行
setMorinaiAsManager();
