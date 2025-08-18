const mysql = require('mysql2/promise');

// データベース接続設定
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'shinomoto926!',
  database: 'curriculum-portal',
  charset: 'utf8mb4'
};

async function setCurrentUserAsManager() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('データベースに接続しました');

    // 現在のユーザーIDを入力してもらう（実際のユーザーIDに置き換えてください）
    const currentUserId = 1; // ここに実際のユーザーIDを入力してください
    
    // ユーザー情報を取得
    const [userRows] = await connection.execute(
      'SELECT id, name, role FROM user_accounts WHERE id = ?',
      [currentUserId]
    );

    if (userRows.length === 0) {
      console.log('ユーザーが見つかりません');
      return;
    }

    const user = userRows[0];
    console.log('ユーザー情報:', user);

    // ユーザーが所属する拠点を取得
    const [satelliteRows] = await connection.execute(`
      SELECT s.id, s.name, s.manager_ids
      FROM satellites s
      WHERE JSON_CONTAINS(s.id, ?) OR s.id IN (
        SELECT JSON_UNQUOTE(JSON_EXTRACT(satellite_ids, '$[*]')) 
        FROM user_accounts 
        WHERE id = ?
      )
    `, [JSON.stringify(currentUserId), currentUserId]);

    if (satelliteRows.length === 0) {
      console.log('ユーザーが所属する拠点が見つかりません');
      return;
    }

    console.log('所属拠点:', satelliteRows);

    // 各拠点で管理者として設定
    for (const satellite of satelliteRows) {
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
      if (managerIds.includes(currentUserId)) {
        console.log(`拠点 "${satellite.name}" は既に管理者として設定されています`);
        continue;
      }

      // 管理者として追加
      managerIds.push(currentUserId);
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
setCurrentUserAsManager();
