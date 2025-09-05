// Docker環境では環境変数はdocker-compose.ymlで設定されるため、.envファイルは読み込まない
if (!process.env.DB_HOST) {
  require('dotenv').config({ path: __dirname + '/../.env' });
}

console.log('=== Database Configuration Debug ===');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PORT:', process.env.DB_PORT);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shinomoto926!',
  database: process.env.DB_NAME || 'curriculum-portal',
  port: process.env.DB_PORT || 3306, // 3307から3306に修正
  waitForConnections: true,
  connectionLimit: 10, // 接続数を適切に制限
  queueLimit: 5, // キュー制限を設定
  // MySQL2で有効な設定オプションのみ使用
  charset: 'utf8mb4'
};

module.exports = dbConfig; 