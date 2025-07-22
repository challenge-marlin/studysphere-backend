const bcrypt = require('bcryptjs');

// パスワードハッシュ生成
const generateHash = async (password) => {
  const saltRounds = 12;
  const hash = await bcrypt.hash(password, saltRounds);
  console.log('Password:', password);
  console.log('Hash:', hash);
  return hash;
};

// 管理者アカウント用のハッシュを生成
generateHash('admin123')
  .then(() => {
    console.log('\nハッシュ生成完了！');
    process.exit(0);
  })
  .catch(error => {
    console.error('エラー:', error);
    process.exit(1);
  }); 