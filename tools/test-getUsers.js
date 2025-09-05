const { getUsers } = require('./scripts/userController');

async function testGetUsers() {
  try {
    console.log('=== getUsers関数テスト開始 ===');
    
    const result = await getUsers();
    
    console.log('getUsers関数実行完了');
    console.log('結果:', result);
    
    if (result.success) {
      console.log('成功: ユーザー数:', result.data.count);
      console.log('最初のユーザー:', result.data.users[0]);
    } else {
      console.log('失敗:', result.message);
      console.log('エラー:', result.error);
    }
    
  } catch (error) {
    console.error('=== getUsers関数テストエラー ===');
    console.error('エラーメッセージ:', error.message);
    console.error('エラースタック:', error.stack);
  }
  
  process.exit(0);
}

testGetUsers();
