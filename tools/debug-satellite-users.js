const { pool } = require('./backend/utils/database');

async function debugSatelliteUsers() {
  let connection;
  try {
    console.log('=== 拠点ユーザーデバッグ開始 ===');
    
    connection = await pool.getConnection();
    console.log('データベース接続取得成功');
    
    // 1. 全ユーザーのsatellite_idsを確認
    console.log('\n--- 全ユーザーのsatellite_ids確認 ---');
    const [allUsers] = await connection.execute(`
      SELECT id, name, role, satellite_ids, status
      FROM user_accounts
      ORDER BY id
    `);
    
    console.log(`全ユーザー数: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(`ID: ${user.id}, 名前: ${user.name}, ロール: ${user.role}, satellite_ids: ${user.satellite_ids}, ステータス: ${user.status}`);
    });
    
    // 2. 拠点情報を確認
    console.log('\n--- 拠点情報確認 ---');
    const [satellites] = await connection.execute(`
      SELECT id, name, company_id, max_users
      FROM satellites
      ORDER BY id
    `);
    
    console.log(`拠点数: ${satellites.length}`);
    satellites.forEach(satellite => {
      console.log(`拠点ID: ${satellite.id}, 名前: ${satellite.name}, 企業ID: ${satellite.company_id}, 最大利用者数: ${satellite.max_users}`);
    });
    
    // 3. 拠点に所属するユーザーを確認（修正前のクエリ）
    console.log('\n--- 拠点に所属するユーザー確認（修正前クエリ） ---');
    const [oldQueryResult] = await connection.execute(`
      SELECT 
        s.id as satellite_id,
        s.name as satellite_name,
        COUNT(DISTINCT ua.id) as user_count
      FROM satellites s
      LEFT JOIN user_accounts ua ON (
        (ua.role = 1 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
          CASE 
            WHEN ua.satellite_ids LIKE '[%]' THEN (
              JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
              JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
              JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
            )
            ELSE ua.satellite_ids = s.id
          END
        ) AND ua.status = 1) OR
        (ua.role >= 4 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
          CASE 
            WHEN ua.satellite_ids LIKE '[%]' THEN (
              JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
              JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
              JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
            )
            ELSE ua.satellite_ids = s.id
          END
        ) AND ua.status = 1)
      )
      GROUP BY s.id, s.name
      ORDER BY s.id
    `);
    
    console.log('修正前クエリ結果:');
    oldQueryResult.forEach(result => {
      console.log(`拠点ID: ${result.satellite_id}, 名前: ${result.satellite_name}, 利用者数: ${result.user_count}`);
    });
    
    // 4. 各拠点に所属するユーザーの詳細を確認
    console.log('\n--- 各拠点に所属するユーザーの詳細 ---');
    for (const satellite of satellites) {
      console.log(`\n拠点: ${satellite.name} (ID: ${satellite.id})`);
      
      const [usersInSatellite] = await connection.execute(`
        SELECT id, name, role, satellite_ids, status
        FROM user_accounts
        WHERE (
          (role = 1 AND satellite_ids IS NOT NULL AND satellite_ids != 'null' AND satellite_ids != '[]' AND (
            CASE 
              WHEN satellite_ids LIKE '[%]' THEN JSON_CONTAINS(satellite_ids, ?)
              ELSE satellite_ids = ?
            END
          ) AND status = 1) OR
          (role >= 4 AND satellite_ids IS NOT NULL AND satellite_ids != 'null' AND satellite_ids != '[]' AND (
            CASE 
              WHEN satellite_ids LIKE '[%]' THEN JSON_CONTAINS(satellite_ids, ?)
              ELSE satellite_ids = ?
            END
          ) AND status = 1)
        )
      `, [JSON.stringify(satellite.id), satellite.id, JSON.stringify(satellite.id), satellite.id]);
      
      if (usersInSatellite.length === 0) {
        console.log('  所属ユーザー: なし');
      } else {
        console.log(`  所属ユーザー: ${usersInSatellite.length}人`);
        usersInSatellite.forEach(user => {
          console.log(`    - ID: ${user.id}, 名前: ${user.name}, ロール: ${user.role}, satellite_ids: ${user.satellite_ids}`);
        });
      }
    }
    
    console.log('\n=== 拠点ユーザーデバッグ完了 ===');
    
  } catch (error) {
    console.error('デバッグエラー:', error);
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('データベース接続を解放しました');
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
}

debugSatelliteUsers();
