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
 * サンプル企業データを追加する関数
 */
const addSampleCompanies = async () => {
  let connection;
  
  try {
    console.log('データベースに接続中...');
    connection = await mysql.createConnection(dbConfig);
    
    // サンプル企業データを追加
    console.log('サンプル企業データを追加中...');
    
    const sampleCompanies = [
      { id: 1, name: 'アドミニストレータ' },
      { id: 2, name: 'サンプル企業A' },
      { id: 3, name: 'サンプル企業B' },
      { id: 4, name: 'サンプル企業C' }
    ];
    
    for (const company of sampleCompanies) {
      await connection.execute(`
        INSERT IGNORE INTO companies (id, name) 
        VALUES (?, ?)
      `, [company.id, company.name]);
      console.log(`企業「${company.name}」を追加しました。`);
    }
    
    // 追加された企業データを確認
    console.log('\n追加された企業データを確認中...');
    const [companies] = await connection.execute(`
      SELECT * FROM companies ORDER BY id
    `);
    
    console.log(`企業データ件数: ${companies.length}`);
    console.log('企業データ:', JSON.stringify(companies, null, 2));
    
    console.log('\nサンプル企業データの追加が完了しました！');
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// スクリプト実行
addSampleCompanies(); 