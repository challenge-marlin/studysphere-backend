const { pool } = require('../utils/database');

const listAdminUsers = async () => {
  let connection;
  try {
    connection = await pool.getConnection();

    console.log('🔍 ロール9以上のユーザーを検索中...\n');

    // ロール9以上のユーザーを取得
    const [rows] = await connection.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.email,
        ua.role,
        ua.status,
        ua.login_code,
        ua.company_id,
        ac.username,
        COALESCE(c.name, 'システム管理者') as company_name
      FROM user_accounts ua
      LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.role >= 9
      ORDER BY ua.role DESC, ua.name ASC
    `);

    if (rows.length === 0) {
      console.log('❌ ロール9以上のユーザーが見つかりませんでした');
      return;
    }

    console.log(`📋 ロール9以上のユーザー一覧 (${rows.length}人):\n`);

    rows.forEach((user, index) => {
      const roleLabel = user.role === 10 ? 'マスターユーザー' : 'アドミンユーザー';
      const statusLabel = user.status === 1 ? '有効' : '無効';
      const statusIcon = user.status === 1 ? '✅' : '❌';
      
      console.log(`${index + 1}. ${user.name} (${user.username || 'N/A'})`);
      console.log(`   📧 メール: ${user.email || '未設定'}`);
      console.log(`   🔑 権限: ${roleLabel} (ロール${user.role})`);
      console.log(`   📊 ステータス: ${statusIcon} ${statusLabel}`);
      console.log(`   🏢 所属: ${user.company_name}`);
      console.log(`   🆔 ログインコード: ${user.login_code || 'N/A'}`);
      console.log('');
    });

    // 統計情報
    const masterUsers = rows.filter(user => user.role === 10);
    const adminUsers = rows.filter(user => user.role === 9);
    const activeUsers = rows.filter(user => user.status === 1);
    const inactiveUsers = rows.filter(user => user.status === 0);

    console.log('📊 統計情報:');
    console.log(`   • マスターユーザー: ${masterUsers.length}人`);
    console.log(`   • アドミンユーザー: ${adminUsers.length}人`);
    console.log(`   • 有効ユーザー: ${activeUsers.length}人`);
    console.log(`   • 無効ユーザー: ${inactiveUsers.length}人`);

  } catch (error) {
    console.error('❌ ユーザー一覧取得エラー:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

// スクリプト実行
if (require.main === module) {
  listAdminUsers()
    .then(() => {
      console.log('\n🎉 スクリプトが正常に完了しました');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 スクリプト実行エラー:', error);
      process.exit(1);
    });
}

module.exports = { listAdminUsers }; 