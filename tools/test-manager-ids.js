const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'shinomoto926!',
  database: 'curriculum-portal',
  charset: 'utf8mb4'
};

async function testManagerIds() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('=== 管理者設定テスト開始 ===\n');
    
    // 1. 現在の管理者情報を確認
    console.log('1. 現在の管理者情報を確認:');
    const [currentRows] = await connection.execute(`
      SELECT id, name, manager_ids 
      FROM satellites 
      WHERE manager_ids IS NOT NULL 
      ORDER BY id
    `);
    
    currentRows.forEach(row => {
      console.log(`拠点: ${row.name} (ID: ${row.id})`);
      console.log(`manager_ids: ${row.manager_ids}`);
      try {
        const parsed = JSON.parse(row.manager_ids);
        console.log(`パース後: ${JSON.stringify(parsed)}`);
        console.log(`配列か: ${Array.isArray(parsed)}`);
        console.log(`要素数: ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
      } catch (e) {
        console.log(`パースエラー: ${e.message}`);
      }
      console.log('---');
    });
    
    // 2. テスト用の管理者IDを設定
    const testSatelliteId = 1; // テスト用の拠点ID
    const testManagerIds = [1, 2, 3]; // テスト用の管理者ID
    
    console.log(`\n2. テスト用の管理者IDを設定:`);
    console.log(`拠点ID: ${testSatelliteId}`);
    console.log(`管理者IDs: ${JSON.stringify(testManagerIds)}`);
    
    // 現在の管理者情報を取得
    const [satelliteRows] = await connection.execute(
      'SELECT id, name, manager_ids FROM satellites WHERE id = ?',
      [testSatelliteId]
    );
    
    if (satelliteRows.length === 0) {
      console.log('指定された拠点が見つかりません');
      return;
    }
    
    const satellite = satelliteRows[0];
    console.log(`拠点名: ${satellite.name}`);
    
    // 現在の管理者IDを取得
    let currentManagerIds = [];
    if (satellite.manager_ids) {
      try {
        currentManagerIds = JSON.parse(satellite.manager_ids);
        if (!Array.isArray(currentManagerIds)) {
          currentManagerIds = [currentManagerIds];
        }
      } catch (e) {
        console.error('管理者IDのパースエラー:', e);
        currentManagerIds = [];
      }
    }
    
    console.log(`現在の管理者IDs: ${JSON.stringify(currentManagerIds)}`);
    
    // 新しい管理者IDを既存のリストに追加（重複を避ける）
    const updatedManagerIds = [...new Set([...currentManagerIds, ...testManagerIds])];
    
    console.log(`更新後の管理者IDs: ${JSON.stringify(updatedManagerIds)}`);
    
    // 3. データベースを更新
    const managerIdsJson = JSON.stringify(updatedManagerIds);
    
    await connection.execute(`
      UPDATE satellites 
      SET manager_ids = ?, updated_at = NOW()
      WHERE id = ?
    `, [managerIdsJson, testSatelliteId]);
    
    console.log('データベースを更新しました');
    
    // 4. 更新後の状態を確認
    console.log('\n4. 更新後の状態を確認:');
    const [updatedRows] = await connection.execute(
      'SELECT id, name, manager_ids FROM satellites WHERE id = ?',
      [testSatelliteId]
    );
    
    if (updatedRows.length > 0) {
      const updatedSatellite = updatedRows[0];
      console.log(`拠点名: ${updatedSatellite.name}`);
      console.log(`manager_ids: ${updatedSatellite.manager_ids}`);
      try {
        const parsed = JSON.parse(updatedSatellite.manager_ids);
        console.log(`パース後: ${JSON.stringify(parsed)}`);
        console.log(`配列か: ${Array.isArray(parsed)}`);
        console.log(`要素数: ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
      } catch (e) {
        console.log(`パースエラー: ${e.message}`);
      }
    }
    
    console.log('\n=== テスト完了 ===');
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// スクリプトを実行
testManagerIds();
