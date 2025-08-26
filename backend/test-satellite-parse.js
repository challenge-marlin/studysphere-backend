require('dotenv').config();
const { pool } = require('./utils/database');

async function testSatelliteParse() {
  try {
    console.log('=== satellite_ids パーステスト ===\n');

    const testLoginCode = 'byg3-6b8u-rQxN';
    console.log(`テストログインコード: ${testLoginCode}\n`);

    // ユーザー情報を取得
    const [users] = await pool.execute(
      'SELECT satellite_ids FROM user_accounts WHERE login_code = ?',
      [testLoginCode]
    );

    if (users.length === 0) {
      console.log('❌ ユーザーが見つかりません');
      return;
    }

    const user = users[0];
    console.log(`元のsatellite_ids: "${user.satellite_ids}"`);
    console.log(`型: ${typeof user.satellite_ids}`);
    console.log(`長さ: ${user.satellite_ids ? user.satellite_ids.length : 'null'}\n`);

    // パース処理
    let satelliteIds = [];
    
    if (user.satellite_ids) {
      if (user.satellite_ids.includes(',')) {
        // カンマ区切りの場合
        satelliteIds = user.satellite_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        console.log('カンマ区切りとして処理');
      } else {
                 // 単一の値の場合
         try {
           const parsed = JSON.parse(user.satellite_ids);
           // JSON.parseの結果が配列の場合はそのまま使用
           if (Array.isArray(parsed)) {
             satelliteIds = parsed;
             console.log('JSON配列として処理');
           } else {
             // 単一の値の場合は配列に変換
             satelliteIds = [parsed];
             console.log('JSON単一値として処理');
           }
         } catch (jsonError) {
          const singleId = parseInt(user.satellite_ids);
          if (!isNaN(singleId)) {
            satelliteIds = [singleId];
            console.log('単一の数値として処理');
          } else {
            console.log('パースに失敗');
            return;
          }
        }
      }
    }

    console.log(`パース結果: ${JSON.stringify(satelliteIds)}`);
    console.log(`配列の長さ: ${satelliteIds.length}`);
    console.log(`最初の要素: ${satelliteIds[0]}`);
    console.log(`最初の要素の型: ${typeof satelliteIds[0]}\n`);

    if (satelliteIds.length > 0 && satelliteIds[0] !== undefined) {
      // 拠点情報を取得
      const [satellites] = await pool.execute(
        'SELECT id, name, token FROM satellites WHERE id = ?',
        [satelliteIds[0]]
      );

      if (satellites.length > 0) {
        const satellite = satellites[0];
        console.log('✅ 拠点情報取得成功:');
        console.log(`  - ID: ${satellite.id}`);
        console.log(`  - 名前: ${satellite.name}`);
        console.log(`  - トークン: ${satellite.token}`);
      } else {
        console.log('❌ 拠点情報が見つかりません');
      }
    } else {
      console.log('❌ 有効な拠点IDがありません');
    }

  } catch (error) {
    console.error('❌ エラーが発生:', error.message);
  } finally {
    await pool.end();
  }
}

testSatelliteParse();
