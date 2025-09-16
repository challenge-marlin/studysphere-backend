const axios = require('axios');

async function testPendingApprovals() {
  try {
    console.log('=== テスト承認APIテスト開始 ===');
    
    // テスト用の認証トークン（実際のトークンに置き換えてください）
    const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo5LCJ1c2VybmFtZSI6IuWwj-OCpOOBruOBhOOBpOOBryIsInJvbGUiOjksImlhdCI6MTc1Nzk5MTQ5MCwiZXhwIjoxNzU4MDc3ODkwfQ.8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q';
    
    const response = await axios.get('http://localhost:5050/api/test/instructor/pending-approvals?satelliteId=1', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('レスポンスステータス:', response.status);
    console.log('レスポンスデータ:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('エラー:', error.message);
    if (error.response) {
      console.error('レスポンスステータス:', error.response.status);
      console.error('レスポンスデータ:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testPendingApprovals();
