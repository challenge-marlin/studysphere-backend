const bcrypt = require('bcryptjs');

/**
 * パスワードハッシュを生成する関数
 * @param {string} password - 平文パスワード
 * @param {number} saltRounds - ソルトラウンド数（デフォルト: 12）
 * @returns {string} ハッシュ化されたパスワード
 */
const generateHash = async (password, saltRounds = 12) => {
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log(`パスワード: ${password}`);
    console.log(`ハッシュ: ${hash}`);
    return hash;
  } catch (error) {
    console.error('ハッシュ生成エラー:', error);
    throw error;
  }
};

/**
 * パスワードを検証する関数
 * @param {string} password - 平文パスワード
 * @param {string} hash - ハッシュ化されたパスワード
 * @returns {boolean} 一致するかどうか
 */
const verifyPassword = async (password, hash) => {
  try {
    const isValid = await bcrypt.compare(password, hash);
    console.log(`パスワード検証結果: ${isValid}`);
    return isValid;
  } catch (error) {
    console.error('パスワード検証エラー:', error);
    throw error;
  }
};

// メイン処理
const main = async () => {
  const password = process.argv[2] || 'admin123';
  
  console.log('=== パスワードハッシュ生成 ===');
  const hash = await generateHash(password);
  
  console.log('\n=== パスワード検証 ===');
  await verifyPassword(password, hash);
  
  console.log('\n=== 既知のハッシュとの比較 ===');
  const knownHash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.gS8O.m';
  await verifyPassword('admin123', knownHash);
};

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  generateHash,
  verifyPassword
}; 