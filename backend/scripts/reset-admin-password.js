#!/usr/bin/env node
/**
 * 管理者 admin001 のパスワードを "admin123" にリセットするスクリプト。
 * DB の password_hash を bcryptjs で生成したハッシュに更新し、init.sql も同じハッシュで更新します。
 *
 * ホストから実行する場合（Docker の MySQL に接続）:
 *   cd studysphere-backend/backend
 *   DB_HOST=localhost DB_PORT=3307 DB_USER=root DB_PASSWORD=shinomoto926! DB_NAME=curriculum-portal node scripts/reset-admin-password.js
 *
 * コンテナ内で実行する場合:
 *   docker compose exec backend node scripts/reset-admin-password.js
 */

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

if (!process.env.DB_HOST) {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shinomoto926!',
  database: process.env.DB_NAME || 'curriculum-portal',
  port: parseInt(process.env.DB_PORT, 10) || 3306
};

const ADMIN_PASSWORD = 'admin123';
const ADMIN_USERNAME = 'admin001';

// init.sql のパス（backend/scripts/ から見て ../../db/init.sql）
const INIT_SQL_PATH = path.join(__dirname, '../../db/init.sql');

function updateInitSql(newHash) {
  try {
    let content = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    // 既存の bcrypt ハッシュ（$2a$ または $2b$）を新しいハッシュに置換
    content = content.replace(
      /(INSERT INTO admin_credentials \(user_id, username, password_hash\) VALUES \s*\(\s*1\s*,\s*'admin001'\s*,\s*)'\$2[ab]\$12\$[^']+'(\))/,
      `$1'${newHash}'$2`
    );
    fs.writeFileSync(INIT_SQL_PATH, content);
    console.log('init.sql updated with new hash (for future DB inits).');
  } catch (err) {
    console.warn('Could not update init.sql:', err.message);
  }
}

async function main() {
  let connection;
  try {
    console.log('=== Reset admin password (admin001 / admin123) ===');
    console.log('Generating hash with bcryptjs...');
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    console.log('Hash generated.');

    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected.');

    const [result] = await connection.execute(
      'UPDATE admin_credentials SET password_hash = ? WHERE username = ?',
      [passwordHash, ADMIN_USERNAME]
    );

    if (result.affectedRows === 0) {
      console.error('No row updated. Check that admin001 exists in admin_credentials.');
      process.exit(1);
    }

    console.log('Password updated successfully.');
    updateInitSql(passwordHash);
    console.log('You can now log in with: ID=admin001, Password=admin123');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
