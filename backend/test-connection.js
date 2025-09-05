const http = require('http');

// テスト用のHTTPリクエスト
const testRequest = (path, method = 'GET', data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5050,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: responseData
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
};

// テスト実行
async function runTests() {
  console.log('=== 接続テスト開始 ===');
  
  try {
    // 1. ルートエンドポイントのテスト
    console.log('1. ルートエンドポイントのテスト...');
    const rootResponse = await testRequest('/');
    console.log('ルートレスポンス:', rootResponse.statusCode, rootResponse.data);
    
    // 2. ログインエンドポイントのテスト
    console.log('2. ログインエンドポイントのテスト...');
    const loginResponse = await testRequest('/api/login', 'POST', {
      username: 'test',
      password: 'test'
    });
    console.log('ログインレスポンス:', loginResponse.statusCode, loginResponse.data);
    
  } catch (error) {
    console.error('テストエラー:', error.message);
  }
  
  console.log('=== 接続テスト完了 ===');
}

runTests();