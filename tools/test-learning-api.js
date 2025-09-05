const http = require('http');

// 学習APIのテスト
function testLearningAPI() {
  const baseUrl = 'localhost';
  const port = 3000;
  
  console.log('=== 学習APIテスト開始 ===');
  
  // 1. 利用者ID: 98の学習進捗取得テスト
  console.log('\n1. 利用者ID: 98の学習進捗取得テスト');
  const progressOptions = {
    hostname: baseUrl,
    port: port,
    path: '/api/learning/progress/98',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const progressReq = http.request(progressOptions, (res) => {
    console.log('Status:', res.statusCode);
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('Response:', data);
      
      // 2. 利用者とコースの関連付け作成テスト
      console.log('\n2. 利用者とコースの関連付け作成テスト');
      const assignOptions = {
        hostname: baseUrl,
        port: port,
        path: '/api/learning/assign-course',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const assignReq = http.request(assignOptions, (assignRes) => {
        console.log('Status:', assignRes.statusCode);
        let assignData = '';
        assignRes.on('data', (chunk) => {
          assignData += chunk;
        });
        assignRes.on('end', () => {
          console.log('Response:', assignData);
          
          // 3. 再度学習進捗取得テスト
          console.log('\n3. 再度学習進捗取得テスト');
          const retryReq = http.request(progressOptions, (retryRes) => {
            console.log('Status:', retryRes.statusCode);
            let retryData = '';
            retryRes.on('data', (chunk) => {
              retryData += chunk;
            });
            retryRes.on('end', () => {
              console.log('Response:', retryData);
            });
          });
          
          retryReq.on('error', (error) => {
            console.error('Retry request error:', error);
          });
          
          retryReq.end();
        });
      });
      
      assignReq.on('error', (error) => {
        console.error('Assign request error:', error);
      });
      
      const assignBody = JSON.stringify({
        userId: 98,
        courseId: 1
      });
      
      assignReq.write(assignBody);
      assignReq.end();
    });
  });
  
  progressReq.on('error', (error) => {
    console.error('Progress request error:', error);
  });
  
  progressReq.end();
}

// テスト実行
testLearningAPI();
