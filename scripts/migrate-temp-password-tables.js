// 環境変数の読み込み（.envファイルが存在しない場合でも動作）
try {
  require('dotenv').config({ path: __dirname + '/../backend/.env' });
} catch (error) {
  console.log('.envファイルが見つからないため、デフォルト設定を使用します');
}

const mysql = require('mysql2/promise');
const { customLogger } = require('../backend/utils/logger');

// データベース設定
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shinomoto926!',
  database: process.env.DB_NAME || 'curriculum-portal',
  port: process.env.DB_PORT || 3307, // Docker環境では3307ポートを使用
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 5,
  charset: 'utf8mb4'
};

// デバッグ用：設定値を表示
console.log('=== Database Configuration Debug ===');
console.log('DB_HOST:', dbConfig.host);
console.log('DB_USER:', dbConfig.user);
console.log('DB_NAME:', dbConfig.database);
console.log('DB_PORT:', dbConfig.port);

// データベース接続プールの作成
const pool = mysql.createPool(dbConfig);

async function migrateTempPasswordTables() {
    try {
        console.log('一時パスワード機能用テーブルのマイグレーションを開始します...');

        // アナウンスメッセージテーブルの作成
        console.log('アナウンスメッセージテーブルを作成中...');
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS \`announcements\` (
                \`id\` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'アナウンスID',
                \`title\` VARCHAR(255) NOT NULL COMMENT 'アナウンスタイトル',
                \`message\` TEXT NOT NULL COMMENT 'アナウンスメッセージ',
                \`created_by\` INT NOT NULL COMMENT '作成者ID',
                \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
                \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
                FOREIGN KEY (\`created_by\`) REFERENCES \`user_accounts\`(\`id\`) ON DELETE CASCADE,
                INDEX \`idx_created_by\` (\`created_by\`),
                INDEX \`idx_created_at\` (\`created_at\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='アナウンスメッセージテーブル'
        `);

        // 利用者アナウンス関連付けテーブルの作成
        console.log('利用者アナウンス関連付けテーブルを作成中...');
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS \`user_announcements\` (
                \`id\` INT AUTO_INCREMENT PRIMARY KEY COMMENT '関連付けID',
                \`user_id\` INT NOT NULL COMMENT '利用者ID',
                \`announcement_id\` INT NOT NULL COMMENT 'アナウンスID',
                \`is_read\` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '既読フラグ',
                \`read_at\` TIMESTAMP NULL DEFAULT NULL COMMENT '既読日時',
                \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
                FOREIGN KEY (\`user_id\`) REFERENCES \`user_accounts\`(\`id\`) ON DELETE CASCADE,
                FOREIGN KEY (\`announcement_id\`) REFERENCES \`announcements\`(\`id\`) ON DELETE CASCADE,
                UNIQUE KEY \`unique_user_announcement\` (\`user_id\`, \`announcement_id\`),
                INDEX \`idx_user_id\` (\`user_id\`),
                INDEX \`idx_announcement_id\` (\`announcement_id\`),
                INDEX \`idx_is_read\` (\`is_read\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='利用者アナウンス関連付けテーブル'
        `);

        // user_temp_passwordsテーブルが存在するかチェック
        console.log('一時パスワードテーブルの存在確認中...');
        const [tempPasswordTableExists] = await pool.execute(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = ? 
            AND table_name = 'user_temp_passwords'
        `, [dbConfig.database]);

        if (tempPasswordTableExists[0].count === 0) {
            console.log('一時パスワードテーブルを作成中...');
            await pool.execute(`
                CREATE TABLE \`user_temp_passwords\` (
                    \`id\` INT AUTO_INCREMENT PRIMARY KEY COMMENT '一時パスワードID',
                    \`user_id\` INT NOT NULL COMMENT 'ユーザーID（user_accounts.id）',
                    \`temp_password\` VARCHAR(10) NOT NULL COMMENT '一時パスワード（XXXX-XXXX形式）',
                    \`issued_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '発行日時',
                    \`expires_at\` DATETIME NOT NULL COMMENT '有効期限（日本時間23:59）',
                    \`is_used\` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '使用済みフラグ（1=使用済み、0=未使用）',
                    \`used_at\` DATETIME DEFAULT NULL COMMENT '使用日時',
                    FOREIGN KEY (\`user_id\`) REFERENCES \`user_accounts\`(\`id\`) ON DELETE CASCADE,
                    INDEX \`idx_user_id\` (\`user_id\`),
                    INDEX \`idx_expires_at\` (\`expires_at\`),
                    INDEX \`idx_is_used\` (\`is_used\`)
                ) COMMENT = '利用者一時パスワード管理テーブル（ロール1専用）'
            `);
        } else {
            console.log('一時パスワードテーブルは既に存在します');
        }

        console.log('マイグレーションが完了しました！');
        
        // テーブル作成確認
        const [tables] = await pool.execute(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = ? 
            AND table_name IN ('announcements', 'user_announcements', 'user_temp_passwords')
        `, [dbConfig.database]);
        
        console.log('作成されたテーブル:');
        tables.forEach(table => {
            console.log(`- ${table.table_name}`);
        });

    } catch (error) {
        console.error('マイグレーションエラー:', error);
        customLogger.error('一時パスワードテーブルマイグレーションエラー:', error);
        throw error;
    } finally {
        // 接続プールを終了
        await pool.end();
    }
}

// スクリプトが直接実行された場合
if (require.main === module) {
    migrateTempPasswordTables()
        .then(() => {
            console.log('マイグレーションが正常に完了しました');
            process.exit(0);
        })
        .catch((error) => {
            console.error('マイグレーションが失敗しました:', error);
            process.exit(1);
        });
}

module.exports = { migrateTempPasswordTables };
