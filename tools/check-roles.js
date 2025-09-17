const mysql = require('mysql2/promise');

const config = {
    host: 'localhost',
    user: 'root',
    password: 'shinomoto926!',
    database: 'curriculum-portal',
    port: 3307,
    charset: 'utf8mb4'
};

async function checkRoles() {
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('接続成功');

        // 全ユーザーの役割を確認
        const [users] = await connection.execute("SELECT id, name, email, role FROM user_accounts ORDER BY id");
        console.log('全ユーザー:');
        users.forEach(user => {
            console.log(`ID: ${user.id}, 名前: ${user.name}, メール: ${user.email}, 役割: ${user.role}`);
        });

        // 役割の種類を確認
        const [roles] = await connection.execute("SELECT DISTINCT role FROM user_accounts");
        console.log('\n役割の種類:', roles.map(r => r.role));

    } catch (error) {
        console.error('エラー:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkRoles();
