const bcrypt = require('bcryptjs');
const { pool } = require('./backend/utils/database');

async function resetPassword() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // テスト用パスワード: test123
    const password = 'test123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log('新しいパスワード:', password);
    console.log('ハッシュ:', hashedPassword);
    
    // 盛内稔史さんのパスワードを更新
    const [result] = await connection.execute(
      'UPDATE admin_credentials SET password_hash = ? WHERE user_id = 6',
      [hashedPassword]
    );
    
    if (result.affectedRows > 0) {
      console.log('パスワードが正常に更新されました');
      console.log('盛内稔史さんのログイン情報:');
      console.log('ユーザー名: moriuchi1101');
      console.log('パスワード: test123');
    } else {
      console.log('パスワードの更新に失敗しました');
    }
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    if (connection) {
      connection.release();
    }
    process.exit(0);
  }
}

resetPassword();
