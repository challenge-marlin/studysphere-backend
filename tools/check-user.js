const mysql = require('mysql2/promise');

async function checkUser() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'shinomoto926!',
    database: 'curriculum-portal',
    port: 3307
  });
  
  try {
    const [rows] = await connection.execute(
      'SELECT ac.username, ac.password_hash, ua.name, ua.role, ua.status FROM admin_credentials ac JOIN user_accounts ua ON ac.user_id = ua.id WHERE ac.username = ?', 
      ['ono1105']
    );
    
    console.log('User found:', rows.length > 0);
    if (rows.length > 0) {
      console.log('User data:', {
        username: rows[0].username,
        name: rows[0].name,
        role: rows[0].role,
        status: rows[0].status,
        has_password: rows[0].password_hash ? 'Yes' : 'No',
        password_length: rows[0].password_hash ? rows[0].password_hash.length : 0
      });
    } else {
      console.log('User not found in database');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
    process.exit();
  }
}

checkUser();
