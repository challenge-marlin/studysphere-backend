const https = require('https');
const http = require('http');

async function testCertificatesAPI() {
  try {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo5OCwidXNlcm5hbWUiOiLljp_nlLDjgIDlubjovJ0iLCJyb2xlIjoxLCJjb21wYW55X2lkIjoxLCJpYXQiOjE3NTc1NTc3MTMsImV4cCI6MTc1NzU2MTMxM30.BIZhWypt5BxW8mlTB4zQKnjAnGe-bpb1LvzFz88BQSc';
    
    console.log('Testing certificates API...');
    console.log('URL: http://localhost:5050/api/learning/certificates/98');
    
    const options = {
      hostname: 'localhost',
      port: 5050,
      path: '/api/learning/certificates/98',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      console.log('Response Status:', res.statusCode);
      console.log('Response Headers:', res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log('Response Data:', JSON.stringify(jsonData, null, 2));
        } catch (e) {
          console.log('Response Data (raw):', data);
        }
        process.exit(0);
      });
    });
    
    req.on('error', (error) => {
      console.error('Request Error:', error.message);
    });
    
    req.end();
    
  } catch (error) {
    console.error('Error testing API:', error.message);
  }
}

testCertificatesAPI();
