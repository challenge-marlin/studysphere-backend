const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { dbConfig } = require('../config/database');

async function setupDatabase() {
  let connection;
  
  try {
    console.log('データベース接続を開始...');
    connection = await mysql.createConnection(dbConfig);
    console.log('データベース接続成功');

    // SQLファイルを読み込み（存在するファイルを使用）
    const sqlFilePath = path.join(__dirname, '../db/init.sql');
    console.log('SQLファイルパス:', sqlFilePath);
    
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    console.log('SQLファイル読み込み成功');

    // SQLコマンドを分割して実行
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`実行するSQLコマンド数: ${commands.length}`);

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.trim()) {
        console.log(`SQLコマンド ${i + 1} を実行中...`);
        console.log('コマンド:', command.substring(0, 100) + '...');
        
        try {
          await connection.execute(command);
          console.log(`SQLコマンド ${i + 1} 実行成功`);
        } catch (error) {
          console.error(`SQLコマンド ${i + 1} 実行エラー:`, error.message);
          // テーブルが既に存在する場合は無視
          if (!error.message.includes('already exists')) {
            throw error;
          }
        }
      }
    }

    console.log('データベースセットアップ完了！');
    
  } catch (error) {
    console.error('データベースセットアップエラー:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('データベース接続終了');
    }
  }
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  console.log('setupDatabase.js は手動実行専用です。アプリケーション起動時には実行されません。');
  setupDatabase()
    .then(() => {
      console.log('セットアップが正常に完了しました');
      process.exit(0);
    })
    .catch((error) => {
      console.error('セットアップに失敗しました:', error);
      process.exit(1);
    });
}

module.exports = setupDatabase;
