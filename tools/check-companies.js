const mysql = require('mysql2/promise');

// データベース設定
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'shinomoto926!',
  database: 'curriculum-portal',
  port: 3307,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

/**
 * 企業データを確認する関数
 */
const checkCompanies = async () => {
  let connection;
  
  try {
    console.log('データベースに接続中...');
    connection = await mysql.createConnection(dbConfig);
    
    // 企業テーブルの存在確認
    console.log('企業テーブルの存在確認中...');
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'companies'
    `);
    
    if (tables.length === 0) {
      console.log('企業テーブルが存在しません！');
      return;
    }
    
    console.log('企業テーブルが存在します。');
    
    // 企業データを取得
    console.log('企業データを取得中...');
    const [companies] = await connection.execute(`
      SELECT * FROM companies
    `);
    
    console.log(`企業データ件数: ${companies.length}`);
    console.log('企業データ:', JSON.stringify(companies, null, 2));
    
    // 拠点データも確認
    console.log('\n拠点データを取得中...');
    const [satellites] = await connection.execute(`
      SELECT * FROM satellites
    `);
    
    console.log(`拠点データ件数: ${satellites.length}`);
    console.log('拠点データ:', JSON.stringify(satellites, null, 2));
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// スクリプト実行
checkCompanies(); 