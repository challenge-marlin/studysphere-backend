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

async function debugUserInfo() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('データベースに接続しました');

    // 盛内稔史さんのユーザー情報を詳細に確認
    const [userRows] = await connection.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.role,
        ua.company_id,
        ua.satellite_ids,
        ua.status,
        ac.username,
        c.name as company_name
      FROM user_accounts ua
      LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.name LIKE '%盛内%' OR ua.name LIKE '%稔史%'
    `);

    console.log('=== 盛内稔史さんのユーザー情報 ===');
    if (userRows.length === 0) {
      console.log('盛内稔史さんが見つかりません');
      return;
    }

    const user = userRows[0];
    console.log('ユーザー情報:', {
      id: user.id,
      name: user.name,
      role: user.role,
      company_id: user.company_id,
      company_name: user.company_name,
      satellite_ids: user.satellite_ids,
      status: user.status,
      username: user.username
    });

    // 所属拠点の詳細情報を確認
    let satelliteIds = [];
    if (user.satellite_ids) {
      try {
        satelliteIds = JSON.parse(user.satellite_ids);
        console.log('所属拠点IDs:', satelliteIds);
      } catch (error) {
        console.error('satellite_idsのパースエラー:', error);
        return;
      }
    }

    if (satelliteIds.length > 0) {
      const placeholders = satelliteIds.map(() => '?').join(',');
      const [satelliteRows] = await connection.execute(`
        SELECT 
          id,
          name,
          manager_ids,
          company_id,
          status
        FROM satellites
        WHERE id IN (${placeholders})
      `, satelliteIds);

      console.log('\n=== 所属拠点の詳細情報 ===');
      satelliteRows.forEach(satellite => {
        console.log(`拠点ID: ${satellite.id}, 拠点名: ${satellite.name}`);
        console.log(`  管理者IDs (raw): ${satellite.manager_ids || '未設定'}`);
        console.log(`  企業ID: ${satellite.company_id}, ステータス: ${satellite.status}`);
        
        // 管理者判定（安全なパース）
        if (satellite.manager_ids) {
          try {
            // まず文字列として確認
            console.log(`  管理者IDs (type): ${typeof satellite.manager_ids}`);
            
            let managerIds;
            if (typeof satellite.manager_ids === 'string') {
              // 文字列の場合、JSONとしてパースを試行
              try {
                managerIds = JSON.parse(satellite.manager_ids);
              } catch (parseError) {
                console.log(`  JSONパース失敗: ${parseError.message}`);
                // 単一のIDとして扱う
                managerIds = [satellite.manager_ids];
              }
            } else {
              managerIds = satellite.manager_ids;
            }
            
            console.log(`  パース後の管理者IDs: ${JSON.stringify(managerIds)}`);
            
            if (Array.isArray(managerIds)) {
              const isManager = managerIds.some(id => String(id) === String(user.id));
              console.log(`  管理者判定: ${isManager ? '管理者' : '非管理者'}`);
            } else {
              console.log(`  管理者IDsが配列ではありません: ${typeof managerIds}`);
            }
          } catch (error) {
            console.error('  管理者判定エラー:', error);
          }
        }
      });
    }

    // 全拠点の管理者設定状況を確認
    const [allSatellites] = await connection.execute(`
      SELECT id, name, manager_ids
      FROM satellites
      ORDER BY id
    `);

    console.log('\n=== 全拠点の管理者設定状況 ===');
    allSatellites.forEach(satellite => {
      console.log(`拠点ID: ${satellite.id}, 拠点名: ${satellite.name}`);
      console.log(`  管理者IDs (raw): ${satellite.manager_ids || '未設定'}`);
      
      if (satellite.manager_ids) {
        try {
          let managerIds;
          if (typeof satellite.manager_ids === 'string') {
            try {
              managerIds = JSON.parse(satellite.manager_ids);
            } catch (parseError) {
              managerIds = [satellite.manager_ids];
            }
          } else {
            managerIds = satellite.manager_ids;
          }
          
          if (Array.isArray(managerIds)) {
            console.log(`  管理者数: ${managerIds.length}`);
            console.log(`  管理者IDs: ${JSON.stringify(managerIds)}`);
          } else {
            console.log(`  管理者IDsが配列ではありません: ${typeof managerIds}`);
          }
        } catch (error) {
          console.error('  管理者IDsのパースエラー:', error);
        }
      }
    });

  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

debugUserInfo();
