require('dotenv').config({ path: __dirname + '/../.env' });

console.log('=== Database Configuration Debug ===');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PORT:', process.env.DB_PORT);

const dbConfig = {
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shinomoto926!',
  database: process.env.DB_NAME || 'curriculum-portal',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10, // 接続数を適切に制限
  queueLimit: 5, // キュー制限を設定
  // MySQL2で有効な設定オプションのみ使用
  charset: 'utf8mb4',
  // 接続プールの監視設定
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // 接続の有効期限設定
  acquireTimeout: 60000, // 接続取得タイムアウト（60秒）
  // 接続のアイドル時間制限
  idleTimeout: 60000, // アイドル接続の最大時間（60秒）
  // デバッグ設定（開発環境のみ）
  debug: process.env.NODE_ENV === 'development' ? false : false
};

module.exports = dbConfig; 