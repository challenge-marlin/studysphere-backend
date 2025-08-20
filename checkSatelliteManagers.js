const mysql = require('mysql2/promise');
// require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shinomoto926!',
  database: process.env.DB_NAME || 'curriculum-portal',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function checkSatelliteManagers() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('=== 拠点管理者設定状況確認 ===');
    
    // 拠点一覧を取得
    const [satellites] = await connection.execute(`
      SELECT id, name, manager_ids
      FROM satellites
      ORDER BY id
    `);
    
    console.log('拠点一覧:');
    satellites.forEach(satellite => {
      console.log(`- 拠点ID: ${satellite.id}, 拠点名: ${satellite.name}`);
      console.log(`  管理者IDs: ${satellite.manager_ids || '未設定'}`);
    });
    
    // 盛内稔史さんの情報を確認
    const [users] = await connection.execute(`
      SELECT id, name, role, satellite_ids
      FROM user_accounts
      WHERE name LIKE '%盛内%' OR name LIKE '%稔史%'
    `);
    
    console.log('\n盛内稔史さんの情報:');
    users.forEach(user => {
      console.log(`- ユーザーID: ${user.id}, 名前: ${user.name}, ロール: ${user.role}`);
      console.log(`  所属拠点IDs: ${user.satellite_ids || '未設定'}`);
    });
    
    // 全指導員（ロール4）の情報を確認
    const [instructors] = await connection.execute(`
      SELECT id, name, role, satellite_ids
      FROM user_accounts
      WHERE role = 4
      ORDER BY name
    `);
    
    console.log('\n全指導員（ロール4）一覧:');
    instructors.forEach(instructor => {
      console.log(`- ユーザーID: ${instructor.id}, 名前: ${instructor.name}`);
      console.log(`  所属拠点IDs: ${instructor.satellite_ids || '未設定'}`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
    process.exit(0);
  }
}

checkSatelliteManagers();
