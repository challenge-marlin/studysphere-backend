const https = require('https');
const http = require('http');

async function testLoginAPI() {
  try {
    console.log('Testing login API...');
    
    const postData = JSON.stringify({
      username: 'ono1105',
      password: 'Ono1'
    });

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      console.log('Response status:', res.statusCode);
      console.log('Response headers:', res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log('Response data:', jsonData);
          
          if (res.statusCode === 200) {
            console.log('Login successful!');
          } else {
            console.log('Login failed with status:', res.statusCode);
            console.log('Error details:', jsonData);
          }
        } catch (error) {
          console.log('Raw response:', data);
          console.error('Error parsing JSON:', error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
    });

    req.write(postData);
    req.end();
    
  } catch (error) {
    console.error('Error testing login API:', error);
  }
}

// 少し待ってからテスト実行
setTimeout(testLoginAPI, 3000);
