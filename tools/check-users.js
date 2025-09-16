const { pool } = require('../backend/utils/database');

const checkUsers = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 全ユーザーを取得
    const [users] = await connection.execute(`
      SELECT id, name, role, login_code, status 
      FROM user_accounts 
      ORDER BY id
    `);

    console.log('=== 全ユーザー一覧 ===');
    users.forEach(user => {
      const roleName = user.role === 1 ? '利用者' : 
                      user.role === 4 ? '指導員' : 
                      user.role === 5 ? '主任指導員' : 
                      user.role === 9 ? '管理者' : '不明';
      
      console.log(`ID: ${user.id}, 名前: ${user.name}, ロール: ${roleName} (${user.role}), ログインコード: ${user.login_code}, ステータス: ${user.status}`);
    });

    // 利用者のみを取得
    const [students] = await connection.execute(`
      SELECT id, name, login_code, status 
      FROM user_accounts 
      WHERE role = 1 
      ORDER BY id
    `);

    console.log('\n=== 利用者一覧 ===');
    students.forEach(student => {
      console.log(`ID: ${student.id}, 名前: ${student.name}, ログインコード: ${student.login_code}, ステータス: ${student.status}`);
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
  }
};

checkUsers().then(() => {
  console.log('\n=== 確認完了 ===');
  process.exit(0);
}).catch(console.error);
