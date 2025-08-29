const mysql = require('mysql2/promise');

// データベース設定（既存の設定を使用）
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: 'shinomoto926!',
  database: 'curriculum-portal',
  port: 3307
};

const checkAdminUsers = async () => {
  let connection;
  try {
    // データベース接続
    connection = await mysql.createConnection(DB_CONFIG);

    console.log('=== 管理者アカウント確認 ===');

    // 管理者認証情報を取得
    const [adminRows] = await connection.execute(`
      SELECT 
        ac.id,
        ac.user_id,
        ac.username,
        ua.name as user_name,
        ua.email,
        ua.role,
        ua.status,
        ua.company_id,
        COALESCE(c.name, 'システム管理者') as company_name
      FROM admin_credentials ac
      JOIN user_accounts ua ON ac.user_id = ua.id
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.status = 1
        AND ua.role >= 4
      ORDER BY ua.role DESC, ua.name
    `);

    console.log(`管理者アカウント数: ${adminRows.length}`);
    console.log('\n=== 管理者一覧 ===');
    
    adminRows.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.user_name} (${admin.username})`);
      console.log(`   ロール: ${admin.role}`);
      console.log(`   メール: ${admin.email || '未設定'}`);
      console.log(`   企業: ${admin.company_name}`);
      console.log(`   ステータス: ${admin.status === 1 ? '有効' : '無効'}`);
      console.log('');
    });

    // ロール別の統計
    const roleStats = {};
    adminRows.forEach(admin => {
      const role = admin.role;
      roleStats[role] = (roleStats[role] || 0) + 1;
    });

    console.log('=== ロール別統計 ===');
    Object.keys(roleStats).sort((a, b) => parseInt(a) - parseInt(b)).forEach(role => {
      const roleName = role >= 9 ? 'システム管理者' : 
                      role >= 6 ? '一般管理者' : 
                      role >= 4 ? '指導員' : 'その他';
      console.log(`ロール${role} (${roleName}): ${roleStats[role]}人`);
    });

  } catch (error) {
    console.error('エラー:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

checkAdminUsers();
