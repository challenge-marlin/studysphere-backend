const { pool } = require('./backend/utils/database');

async function testSatelliteQuery() {
  let connection;
  try {
    console.log('=== 拠点クエリテスト開始 ===');
    
    connection = await pool.getConnection();
    console.log('データベース接続取得成功');
    
    // 修正したSQLクエリをテスト
    console.log('\n--- 修正したSQLクエリテスト ---');
    const [rows] = await connection.execute(`
      SELECT 
        s.id,
        s.company_id,
        s.name,
        s.address,
        s.phone,
        s.office_type_id,
        s.token,
        s.token_issued_at,
        s.token_expiry_at,
        s.contract_type,
        s.max_users,
        s.status,
        s.manager_ids,
        s.disabled_course_ids,
        s.created_at,
        s.updated_at,
        c.name as company_name,
        ot.type as office_type_name,
        COUNT(DISTINCT ua.id) as current_users,
        ROUND((COUNT(DISTINCT ua.id) / s.max_users) * 100, 1) as utilization_rate
      FROM satellites s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN office_types ot ON s.office_type_id = ot.id
      LEFT JOIN user_accounts ua ON (
        (ua.role = 1 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
          CASE 
            WHEN ua.satellite_ids LIKE '[%]' THEN JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
            WHEN ua.satellite_ids LIKE '%,%' THEN FIND_IN_SET(s.id, ua.satellite_ids)
            ELSE ua.satellite_ids = s.id
          END
        ) AND ua.status = 1) OR
        (ua.role >= 4 AND ua.satellite_ids IS NOT NULL AND ua.satellite_ids != 'null' AND ua.satellite_ids != '[]' AND (
          CASE 
            WHEN ua.satellite_ids LIKE '[%]' THEN JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
            WHEN ua.satellite_ids LIKE '%,%' THEN FIND_IN_SET(s.id, ua.satellite_ids)
            ELSE ua.satellite_ids = s.id
          END
        ) AND ua.status = 1)
      )
      GROUP BY s.id, s.company_id, s.name, s.address, s.phone, s.office_type_id, s.token, s.token_issued_at, s.token_expiry_at, s.contract_type, s.max_users, s.status, s.manager_ids, s.disabled_course_ids, s.created_at, s.updated_at, c.name, ot.type
      ORDER BY s.created_at DESC
    `);
    
    console.log('クエリ結果:');
    rows.forEach(row => {
      console.log(`拠点ID: ${row.id}, 名前: ${row.name}, 利用者数: ${row.current_users}, 稼働率: ${row.utilization_rate}%`);
    });
    
    // 個別の拠点でテスト
    console.log('\n--- 個別拠点テスト ---');
    for (const satellite of rows) {
      console.log(`\n拠点: ${satellite.name} (ID: ${satellite.id})`);
      
      // この拠点に所属するユーザーを個別に確認
      const [users] = await connection.execute(`
        SELECT id, name, role, satellite_ids, status
        FROM user_accounts
        WHERE (
          (role = 1 AND satellite_ids IS NOT NULL AND satellite_ids != 'null' AND satellite_ids != '[]' AND (
            CASE 
              WHEN satellite_ids LIKE '[%]' THEN JSON_CONTAINS(satellite_ids, ?)
              WHEN satellite_ids LIKE '%,%' THEN FIND_IN_SET(?, satellite_ids)
              ELSE satellite_ids = ?
            END
          ) AND status = 1) OR
          (role >= 4 AND satellite_ids IS NOT NULL AND satellite_ids != 'null' AND satellite_ids != '[]' AND (
            CASE 
              WHEN satellite_ids LIKE '[%]' THEN JSON_CONTAINS(satellite_ids, ?)
              WHEN satellite_ids LIKE '%,%' THEN FIND_IN_SET(?, satellite_ids)
              ELSE satellite_ids = ?
            END
          ) AND status = 1)
        )
      `, [JSON.stringify(satellite.id), satellite.id, satellite.id, JSON.stringify(satellite.id), satellite.id, satellite.id]);
      
      console.log(`  所属ユーザー数: ${users.length}`);
      users.forEach(user => {
        console.log(`    - ID: ${user.id}, 名前: ${user.name}, ロール: ${user.role}, satellite_ids: ${user.satellite_ids}`);
      });
    }
    
    console.log('\n=== 拠点クエリテスト完了 ===');
    
  } catch (error) {
    console.error('クエリテストエラー:', error);
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

testSatelliteQuery();
