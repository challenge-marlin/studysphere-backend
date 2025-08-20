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

async function checkSatellite2Manager() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('データベースに接続しました');

    // 拠点2の詳細情報を確認
    const [satelliteRows] = await connection.execute(`
      SELECT 
        s.id,
        s.name,
        s.manager_ids,
        c.name as company_name
      FROM satellites s
      LEFT JOIN companies c ON s.company_id = c.id
      WHERE s.id = 2
    `);

    console.log('=== 拠点2の詳細情報 ===');
    if (satelliteRows.length === 0) {
      console.log('拠点2が見つかりません');
      return;
    }

    const satellite = satelliteRows[0];
    console.log('拠点情報:', {
      id: satellite.id,
      name: satellite.name,
      company_name: satellite.company_name,
      manager_ids: satellite.manager_ids
    });

    // 管理者IDを解析
    let managerIds = [];
    if (satellite.manager_ids) {
      try {
        managerIds = JSON.parse(satellite.manager_ids);
        console.log('管理者ID（解析後）:', managerIds);
      } catch (error) {
        console.error('manager_idsのパースエラー:', error);
      }
    }

    // 盛内稔史さんの情報を確認
    const [userRows] = await connection.execute(`
      SELECT id, name, role, satellite_ids
      FROM user_accounts
      WHERE id = 6
    `);

    if (userRows.length > 0) {
      const user = userRows[0];
      console.log('\n盛内稔史さんの情報:', {
        id: user.id,
        name: user.name,
        role: user.role,
        satellite_ids: user.satellite_ids
      });

      // 管理者判定
      const userIdNum = parseInt(user.id);
      const isManager = managerIds.some(managerId => {
        const managerIdNum = parseInt(managerId);
        return managerIdNum === userIdNum;
      });

      console.log('\n管理者判定結果:', {
        userId: user.id,
        userIdNum: userIdNum,
        managerIds: managerIds,
        isManager: isManager
      });

      if (!isManager) {
        console.log('\n盛内稔史さんを拠点2の管理者として設定します...');
        
        // 既存の管理者リストに追加
        managerIds.push(user.id);
        
        await connection.execute(
          'UPDATE satellites SET manager_ids = ? WHERE id = ?',
          [JSON.stringify(managerIds), satellite.id]
        );
        
        console.log('管理者設定が完了しました');
        
        // 設定後の確認
        const [updatedRows] = await connection.execute(
          'SELECT manager_ids FROM satellites WHERE id = ?',
          [satellite.id]
        );
        
        if (updatedRows.length > 0) {
          console.log('更新後の管理者ID:', updatedRows[0].manager_ids);
        }
      } else {
        console.log('盛内稔史さんは既に拠点2の管理者として設定されています');
      }
    }

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    if (connection) {
      try {
        connection.end();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
}

checkSatellite2Manager();
