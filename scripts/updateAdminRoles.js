const mysql = require('mysql2/promise');

// データベース接続設定
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'shinomoto926!',
  database: 'curriculum-portal',
  port: 3306,
  charset: 'utf8mb4'
};

const pool = mysql.createPool(dbConfig);

const updateAdminRoles = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    console.log('管理者ロールの更新を開始します...');

    // admin001をマスターユーザー（ロール10）に更新
    const [updateResult] = await connection.execute(`
      UPDATE user_accounts 
      SET role = 10, updated_at = CURRENT_TIMESTAMP
      WHERE name = 'admin001'
    `);

    if (updateResult.affectedRows > 0) {
      console.log('✅ admin001をマスターユーザー（ロール10）に更新しました');
    } else {
      console.log('⚠️ admin001が見つかりませんでした');
    }

    // 他の管理者ユーザーをアドミンユーザー（ロール9）に更新
    const [updateOtherResult] = await connection.execute(`
      UPDATE user_accounts 
      SET role = 9, updated_at = CURRENT_TIMESTAMP
      WHERE role >= 5 AND role < 9 AND name != 'admin001'
    `);

    if (updateOtherResult.affectedRows > 0) {
      console.log(`✅ ${updateOtherResult.affectedRows}人の管理者をアドミンユーザー（ロール9）に更新しました`);
    } else {
      console.log('ℹ️ 更新対象の管理者はいませんでした');
    }

    // 更新結果を確認
    const [confirmResult] = await connection.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.role,
        ua.status,
        ac.username
      FROM user_accounts ua
      LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
      WHERE ua.role >= 9
      ORDER BY ua.role DESC, ua.name ASC
    `);

    console.log('\n📋 現在の管理者一覧:');
    confirmResult.forEach(admin => {
      const roleLabel = admin.role === 10 ? 'マスターユーザー' : 'アドミンユーザー';
      const statusLabel = admin.status === 1 ? '有効' : '無効';
      console.log(`  - ${admin.name} (${admin.username}): ${roleLabel} (ロール${admin.role}) - ${statusLabel}`);
    });

    await connection.commit();
    console.log('\n✅ 管理者ロールの更新が完了しました');

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ 管理者ロール更新エラー:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

// スクリプト実行
if (require.main === module) {
  updateAdminRoles()
    .then(() => {
      console.log('🎉 スクリプトが正常に完了しました');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 スクリプト実行エラー:', error);
      process.exit(1);
    });
}

module.exports = { updateAdminRoles }; 