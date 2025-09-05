const axios = require('axios');

async function testLoginAPI() {
  console.log('=== ログインAPIテスト開始 ===');
  
  try {
    const response = await axios.post('http://localhost:5000/api/login', {
      username: 'test',
      password: 'test'
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('レスポンスステータス:', response.status);
    console.log('レスポンスデータ:', response.data);
    
  } catch (error) {
    console.error('API呼び出しエラー:', error.message);
    if (error.response) {
      console.log('エラーレスポンスステータス:', error.response.status);
      console.log('エラーレスポンスデータ:', error.response.data);
    }
  }
  
  console.log('=== ログインAPIテスト終了 ===');
  process.exit(0);
}

testLoginAPI();
