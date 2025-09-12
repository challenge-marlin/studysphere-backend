const mysql = require('mysql2/promise');

const config = {
    host: 'localhost',
    user: 'root',
    password: 'shinomoto926!',
    database: 'curriculum-portal',
    port: 3307,
    charset: 'utf8mb4'
};

async function simpleCheck() {
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('接続成功');

        // 学生ユーザーを取得
        const [users] = await connection.execute("SELECT id, name FROM user_accounts WHERE role = 'student' LIMIT 5");
        console.log('学生ユーザー:', users);

        // アナウンスを取得
        const [announcements] = await connection.execute("SELECT id, title FROM announcements WHERE expires_at > NOW()");
        console.log('有効なアナウンス:', announcements);

        // ユーザーアナウンス関連付けを取得
        const [userAnnouncements] = await connection.execute(`
            SELECT ua.user_id, ua.announcement_id, u.name as user_name, a.title as announcement_title
            FROM user_announcements ua
            JOIN user_accounts u ON ua.user_id = u.id
            JOIN announcements a ON ua.announcement_id = a.id
            WHERE a.expires_at > NOW()
            LIMIT 10
        `);
        console.log('ユーザーアナウンス関連付け:', userAnnouncements);

    } catch (error) {
        console.error('エラー:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

simpleCheck();
