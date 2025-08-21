const fetch = require('node-fetch');

async function testLoginAPI() {
  try {
    console.log('Testing login API...');
    
    const response = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'ono1105',
        password: 'Ono1'
      })
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (!response.ok) {
      console.log('Login failed with status:', response.status);
      console.log('Error details:', data);
    } else {
      console.log('Login successful!');
    }
  } catch (error) {
    console.error('Error testing login API:', error);
  }
}

testLoginAPI();
