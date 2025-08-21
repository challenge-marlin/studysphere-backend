const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function testPassword() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'shinomoto926!',
    database: 'curriculum-portal',
    port: 3307
  });
  
  try {
    const [rows] = await connection.execute(
      'SELECT ac.password_hash FROM admin_credentials ac JOIN user_accounts ua ON ac.user_id = ua.id WHERE ac.username = ?', 
      ['ono1105']
    );
    
    if (rows.length > 0) {
      const storedHash = rows[0].password_hash;
      const testPassword = 'Ono1';
      
      console.log('Testing password:', testPassword);
      console.log('Stored hash:', storedHash);
      
      const isPasswordValid = await bcrypt.compare(testPassword, storedHash);
      console.log('Password valid:', isPasswordValid);
      
      if (!isPasswordValid) {
        console.log('Password verification failed. Let\'s check what hash would be generated:');
        const testHash = await bcrypt.hash(testPassword, 10);
        console.log('Test hash for "Ono1":', testHash);
      }
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
    process.exit();
  }
}

testPassword();
