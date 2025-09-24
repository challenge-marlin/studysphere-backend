const http = require('http');

// ログインテスト用のデータ
const loginData = JSON.stringify({
  username: 'g.sueyoshi',
  password: 'testpassword'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

console.log('=== g.sueyoshi ログインテスト開始 ===');
console.log('リクエストデータ:', loginData);

const req = http.request(options, (res) => {
  console.log('レスポンスステータス:', res.statusCode);
  console.log('レスポンスヘッダー:', res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('=== レスポンス内容 ===');
    try {
      const responseData = JSON.parse(data);
      console.log(JSON.stringify(responseData, null, 2));
    } catch (error) {
      console.log('生のレスポンス:', data);
    }
    console.log('=== テスト完了 ===');
  });
});

req.on('error', (error) => {
  console.error('リクエストエラー:', error.message);
});

req.write(loginData);
req.end();
