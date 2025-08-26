require('dotenv').config();
const { pool } = require('./utils/database');

async function debugUserData() {
  try {
    console.log('=== ユーザーデータデバッグ ===\n');

    // テスト用のログインコード（実際のデータに合わせて変更してください）
    const testLoginCode = 'byg3-6b8u-rQxN'; // 佐藤茂利さんのログインコード（利用者）

    console.log(`ログインコード: ${testLoginCode}\n`);

    // 1. ユーザー情報を取得
    console.log('1. ユーザー情報取得...');
    const [users] = await pool.execute(
      'SELECT id, login_code, company_id, satellite_ids FROM user_accounts WHERE login_code = ?',
      [testLoginCode]
    );

    if (users.length === 0) {
      console.log('❌ ユーザーが見つかりません');
      return;
    }

    const user = users[0];
    console.log('✅ ユーザー情報:');
    console.log(`  - ID: ${user.id}`);
    console.log(`  - ログインコード: ${user.login_code}`);
    console.log(`  - 企業ID: ${user.company_id}`);
    console.log(`  - 拠点IDs: ${user.satellite_ids}\n`);

    // 2. 企業情報を取得
    if (user.company_id) {
      console.log('2. 企業情報取得...');
      const [companies] = await pool.execute(
        'SELECT id, name, token FROM companies WHERE id = ?',
        [user.company_id]
      );

      if (companies.length > 0) {
        const company = companies[0];
        console.log('✅ 企業情報:');
        console.log(`  - ID: ${company.id}`);
        console.log(`  - 名前: ${company.name}`);
        console.log(`  - トークン: ${company.token}\n`);
      } else {
        console.log('❌ 企業情報が見つかりません\n');
      }
    } else {
      console.log('❌ ユーザーの企業IDが設定されていません\n');
    }

         // 3. 拠点情報を取得
     if (user.satellite_ids) {
       console.log('3. 拠点情報取得...');
       try {
         let satelliteIds = [];
         
         // カンマ区切りの文字列として保存されている場合の処理
         if (user.satellite_ids.includes(',')) {
           satelliteIds = user.satellite_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
         } else {
           // 単一の値の場合の処理
           try {
             const parsed = JSON.parse(user.satellite_ids);
             // JSON.parseの結果が配列の場合はそのまま使用
             if (Array.isArray(parsed)) {
               satelliteIds = parsed;
             } else {
               // 単一の値の場合は配列に変換
               satelliteIds = [parsed];
             }
           } catch (jsonError) {
             // JSONとしてパースできない場合は単一の数値として処理
             const singleId = parseInt(user.satellite_ids);
             if (!isNaN(singleId)) {
               satelliteIds = [singleId];
             } else {
               throw jsonError;
             }
           }
         }
         
         console.log(`  - パースされた拠点IDs: ${JSON.stringify(satelliteIds)}`);
         console.log(`  - 配列の長さ: ${satelliteIds.length}`);
         console.log(`  - 最初の要素: ${satelliteIds[0]}`);

         if (satelliteIds.length > 0) {
           const [satellites] = await pool.execute(
             'SELECT id, name, token FROM satellites WHERE id = ?',
             [satelliteIds[0]]
           );

           if (satellites.length > 0) {
             const satellite = satellites[0];
             console.log('✅ 拠点情報:');
             console.log(`  - ID: ${satellite.id}`);
             console.log(`  - 名前: ${satellite.name}`);
             console.log(`  - トークン: ${satellite.token}\n`);
           } else {
             console.log('❌ 拠点情報が見つかりません\n');
           }
         } else {
           console.log('❌ 拠点IDが空です\n');
         }
       } catch (error) {
         console.log(`❌ satellite_idsのパースに失敗: ${error.message}\n`);
       }
     } else {
       console.log('❌ ユーザーの拠点IDsが設定されていません\n');
     }

         // 4. S3パス生成テスト
     console.log('4. S3パス生成テスト...');
     if (user.company_id && user.satellite_ids) {
       try {
         const [companies] = await pool.execute(
           'SELECT token FROM companies WHERE id = ?',
           [user.company_id]
         );
         
         let satelliteIds = [];
         // カンマ区切りの文字列として保存されている場合の処理
         if (user.satellite_ids.includes(',')) {
           satelliteIds = user.satellite_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
         } else {
           // 単一の値の場合の処理
           try {
             const parsed = JSON.parse(user.satellite_ids);
             // JSON.parseの結果が配列の場合はそのまま使用
             if (Array.isArray(parsed)) {
               satelliteIds = parsed;
             } else {
               // 単一の値の場合は配列に変換
               satelliteIds = [parsed];
             }
           } catch (jsonError) {
             // JSONとしてパースできない場合は単一の数値として処理
             const singleId = parseInt(user.satellite_ids);
             if (!isNaN(singleId)) {
               satelliteIds = [singleId];
             } else {
               throw jsonError;
             }
           }
         }
         
         const [satellites] = await pool.execute(
           'SELECT token FROM satellites WHERE id = ?',
           [satelliteIds[0]]
         );

        if (companies.length > 0 && satellites.length > 0) {
          const companyToken = companies[0].token;
          const satelliteToken = satellites[0].token;
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const timestamp = `${year}${month}${day}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

          const basePath = `capture/${companyToken}/${satelliteToken}/${user.login_code}/${year}/${month}/${day}`;
          const photoKey = `${basePath}/camera/${timestamp}.png`;
          const screenshotKey = `${basePath}/screenshot/${timestamp}.png`;

          console.log('✅ S3パス生成成功:');
          console.log(`  - ベースパス: ${basePath}`);
          console.log(`  - カメラ画像: ${photoKey}`);
          console.log(`  - スクリーンショット: ${screenshotKey}\n`);
        } else {
          console.log('❌ 企業または拠点のトークンが見つかりません\n');
        }
      } catch (error) {
        console.log(`❌ S3パス生成に失敗: ${error.message}\n`);
      }
    } else {
      console.log('❌ 企業IDまたは拠点IDsが不足しているためS3パス生成できません\n');
    }

  } catch (error) {
    console.error('❌ デバッグ中にエラーが発生:', error.message);
  } finally {
    await pool.end();
  }
}

// 実行
debugUserData();
