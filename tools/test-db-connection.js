const { testConnection } = require('./utils/database');

async function testDBConnection() {
  console.log('=== データベース接続テスト開始 ===');
  
  try {
    const result = await testConnection();
    
    if (result.success) {
      console.log('✅ データベース接続成功');
      console.log('現在時刻:', result.currentTime);
    } else {
      console.log('❌ データベース接続失敗');
      console.log('エラー:', result.error);
    }
  } catch (error) {
    console.error('❌ データベース接続テスト中にエラーが発生:', error);
  }
  
  console.log('=== データベース接続テスト終了 ===');
  process.exit(0);
}

testDBConnection();
