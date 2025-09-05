const http = require('http');

// APIエンドポイントのテスト
function testAPIEndpoint() {
  console.log('=== APIエンドポイントテスト開始 ===');
  
  // 1. 利用者ID: 98の学習進捗取得テスト
  console.log('\n1. 利用者ID: 98の学習進捗取得テスト');
  const options = {
    hostname: 'localhost',
    port: 5050,
    path: '/api/learning/progress/98',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const req = http.request(options, (res) => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', data);
      
      if (res.statusCode === 404) {
        console.log('\n404エラーの原因を調査中...');
        // 利用者ID 98が存在するかチェック
        testUserExistence();
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('Request error:', error);
  });
  
  req.end();
}

// 利用者の存在確認
function testUserExistence() {
  console.log('\n2. 利用者ID 98の存在確認');
  const userOptions = {
    hostname: 'localhost',
    port: 5050,
    path: '/api/users/98',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const userReq = http.request(userOptions, (res) => {
    console.log('User Status:', res.statusCode);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('User Response:', data);
      
      if (res.statusCode === 404) {
        console.log('\n利用者ID 98は存在しません。');
        console.log('利用可能な利用者IDを確認してください。');
      }
    });
  });
  
  userReq.on('error', (error) => {
    console.error('User request error:', error);
  });
  
  userReq.end();
}

// テスト実行
testAPIEndpoint();
