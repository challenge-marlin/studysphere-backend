const http = require('http');

// テスト承認APIのテスト
function testPendingApprovalsAPI() {
  console.log('=== テスト承認APIテスト開始 ===');
  
  // 1. ログインしてトークンを取得
  console.log('\n1. ログイン中...');
  const loginData = JSON.stringify({
    username: 'admin001',
    password: 'admin123'
  });
  
  const loginOptions = {
    hostname: 'localhost',
    port: 5050,
    path: '/api/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  };
  
  const loginReq = http.request(loginOptions, (res) => {
    console.log('ログインStatus:', res.statusCode);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('ログインレスポンス:', data);
      
      if (res.statusCode === 200) {
        try {
          const loginResponse = JSON.parse(data);
          if (loginResponse.success && loginResponse.data && loginResponse.data.access_token) {
            console.log('トークン取得成功');
            // 2. トークンを使ってテスト承認APIをテスト
            testPendingApprovalsWithToken(loginResponse.data.access_token);
          } else {
            console.log('トークンが取得できませんでした');
            console.log('レスポンス構造:', loginResponse);
          }
        } catch (error) {
          console.error('ログインレスポンスの解析エラー:', error);
        }
      } else {
        console.log('ログインに失敗しました');
      }
    });
  });
  
  loginReq.on('error', (error) => {
    console.error('ログインリクエストエラー:', error);
  });
  
  loginReq.write(loginData);
  loginReq.end();
}

// トークンを使ってテスト承認APIをテスト
function testPendingApprovalsWithToken(token) {
  console.log('\n2. テスト承認APIをテスト中...');
  
  const apiOptions = {
    hostname: 'localhost',
    port: 5050,
    path: '/api/test/instructor/pending-approvals?satelliteId=1',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  
  const apiReq = http.request(apiOptions, (res) => {
    console.log('API Status:', res.statusCode);
    console.log('API Headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('API Response:', data);
      
      if (res.statusCode === 200) {
        try {
          const apiResponse = JSON.parse(data);
          console.log('APIレスポンス解析成功');
          console.log('Success:', apiResponse.success);
          console.log('Data length:', apiResponse.data ? apiResponse.data.length : 0);
          if (apiResponse.data && apiResponse.data.length > 0) {
            console.log('最初のデータ:', JSON.stringify(apiResponse.data[0], null, 2));
          }
        } catch (error) {
          console.error('APIレスポンスの解析エラー:', error);
        }
      } else {
        console.log('API呼び出しに失敗しました');
      }
    });
  });
  
  apiReq.on('error', (error) => {
    console.error('APIリクエストエラー:', error);
  });
  
  apiReq.end();
}

// テスト実行
testPendingApprovalsAPI();
