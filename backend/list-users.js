require('dotenv').config();
const { pool } = require('./utils/database');

async function listUsers() {
  try {
    console.log('=== 利用者（ロール1）一覧 ===\n');

    // 利用者（ロール1）のユーザー一覧を取得
    const [users] = await pool.execute(
      'SELECT id, name, login_code, company_id, satellite_ids, role FROM user_accounts WHERE role = 1 ORDER BY id LIMIT 10'
    );

    if (users.length === 0) {
      console.log('❌ 利用者（ロール1）が見つかりません');
      return;
    }

    console.log(`✅ ${users.length}件の利用者（ロール1）が見つかりました:\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (ID: ${user.id})`);
      console.log(`   - ログインコード: ${user.login_code}`);
      console.log(`   - 企業ID: ${user.company_id}`);
      console.log(`   - 拠点IDs: ${user.satellite_ids}`);
      console.log(`   - ロール: ${user.role}`);
      console.log('');
    });

    console.log('デバッグ用に使用するログインコードを選択してください。');

  } catch (error) {
    console.error('❌ エラーが発生:', error.message);
  } finally {
    await pool.end();
  }
}

// 実行
listUsers();
