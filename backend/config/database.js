// Docker環境では環境変数はdocker-compose.ymlで設定されるため、.envファイルは読み込まない
if (!process.env.DB_HOST) {
  require('dotenv').config({ path: __dirname + '/../.env' });
}

console.log('=== Database Configuration Debug ===');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// 開発環境判定：NODE_ENVがdevelopmentまたは未設定、かつDB_HOSTが未設定の場合
const isDevelopment = (!process.env.NODE_ENV || process.env.NODE_ENV === 'development');
const isLocalDevelopment = isDevelopment && !process.env.DB_HOST;

// 開発環境でDB_HOSTが未設定の場合、127.0.0.1:3307を使用（Docker Composeのポートマッピングに合わせる）
const defaultHost = isLocalDevelopment ? '127.0.0.1' : 'localhost';
const defaultPort = isLocalDevelopment ? 3307 : 3306;

console.log('Development mode:', isDevelopment);
console.log('Local development (no DB_HOST):', isLocalDevelopment);
console.log('Using default host:', defaultHost);
console.log('Using default port:', defaultPort);

const dbConfig = {
  host: process.env.DB_HOST || defaultHost,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shinomoto926!',
  database: process.env.DB_NAME || 'curriculum-portal',
  port: process.env.DB_PORT || defaultPort,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20, // 接続数を適切に制限（本番環境では増やす）
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 10, // キュー制限を設定
  // MySQL2で有効な設定オプションのみ使用
  charset: 'utf8mb4',
  // 文字セット設定を明示的に指定（ENUM値の文字化け対策）
  typeCast: function (field, next) {
    if (field.type === 'ENUM') {
      return field.string();
    }
    return next();
  },
  // タイムゾーン設定（UTCを明示的に指定）
  timezone: 'Z', // UTC
  // SSL設定を無効化（開発環境用）
  ssl: false
};

module.exports = { dbConfig }; 