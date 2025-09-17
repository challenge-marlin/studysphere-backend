const mysql = require('mysql2/promise');

const config = {
    host: 'localhost',
    user: 'root',
    password: 'shinomoto926!',
    database: 'curriculum-portal',
    port: 3307,
    charset: 'utf8mb4'
};

async function checkCurrentUser() {
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('=== 現在のユーザー状況確認 ===');

        // 全学生ユーザー（role=1）の一覧を取得
        const [students] = await connection.execute(`
            SELECT id, name, email, role 
            FROM user_accounts 
            WHERE role = 1 
            ORDER BY id
        `);
        
        console.log('\n=== 学生ユーザー一覧 ===');
        students.forEach(student => {
            console.log(`ID: ${student.id}, 名前: ${student.name}, メール: ${student.email}`);
        });

        // 各学生のアナウンス関連付けを確認
        console.log('\n=== 各学生のアナウンス関連付け ===');
        for (const student of students) {
            const [userAnnouncements] = await connection.execute(`
                SELECT 
                    ua.announcement_id,
                    a.title,
                    a.expires_at,
                    ua.is_read
                FROM user_announcements ua
                JOIN announcements a ON ua.announcement_id = a.id
                WHERE ua.user_id = ?
                AND a.expires_at > NOW()
            `, [student.id]);
            
            console.log(`\n学生ID ${student.id} (${student.name}):`);
            if (userAnnouncements.length === 0) {
                console.log('  アナウンスなし');
            } else {
                userAnnouncements.forEach(ua => {
                    console.log(`  - アナウンスID: ${ua.announcement_id}, タイトル: ${ua.title}, 既読: ${ua.is_read}`);
                });
            }
        }

        // アナウンスが関連付けられていない学生を特定
        console.log('\n=== アナウンスが関連付けられていない学生 ===');
        const studentsWithoutAnnouncements = [];
        for (const student of students) {
            const [userAnnouncements] = await connection.execute(`
                SELECT COUNT(*) as count
                FROM user_announcements ua
                JOIN announcements a ON ua.announcement_id = a.id
                WHERE ua.user_id = ?
                AND a.expires_at > NOW()
            `, [student.id]);
            
            if (userAnnouncements[0].count === 0) {
                studentsWithoutAnnouncements.push(student);
                console.log(`ID: ${student.id}, 名前: ${student.name} - アナウンスなし`);
            }
        }

        if (studentsWithoutAnnouncements.length > 0) {
            console.log(`\n${studentsWithoutAnnouncements.length}人の学生にアナウンスが関連付けられていません。`);
            console.log('これらの学生がログインしている場合、アナウンスが表示されません。');
        }

    } catch (error) {
        console.error('エラー:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkCurrentUser();
