const axios = require('axios');

async function testLoginAndAPI() {
  try {
    console.log('=== ログインとAPIテスト開始 ===');
    
    // 1. ログインしてトークンを取得
    console.log('1. ログイン中...');
    const loginResponse = await axios.post('http://localhost:5050/api/auth/login', {
      username: '末吉 　元気', // 実際のユーザー名に置き換えてください
      password: 'password123' // 実際のパスワードに置き換えてください
    });
    
    console.log('ログイン成功:', loginResponse.data);
    const token = loginResponse.data.token;
    
    // 2. トークンを使ってAPIをテスト
    console.log('2. テスト承認APIをテスト中...');
    const apiResponse = await axios.get('http://localhost:5050/api/test/instructor/pending-approvals?satelliteId=1', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('APIレスポンスステータス:', apiResponse.status);
    console.log('APIレスポンスデータ:', JSON.stringify(apiResponse.data, null, 2));
    
  } catch (error) {
    console.error('エラー:', error.message);
    if (error.response) {
      console.error('レスポンスステータス:', error.response.status);
      console.error('レスポンスデータ:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testLoginAndAPI();
