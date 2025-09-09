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
  .then((hash) => {
    console.log('\n=== 復元エンドポイント用のハッシュ ===');
    console.log('新しいハッシュ:', hash);
    console.log('\nこのハッシュを復元エンドポイントで使用してください。');
    process.exit(0);
  })
  .catch(error => {
    console.error('エラー:', error);
    process.exit(1);
  }); 