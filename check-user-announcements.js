const mysql = require('mysql2/promise');

// ローカルテスト用の設定
const config = {
    host: 'localhost',
    user: 'root',
    password: 'shinomoto926!',
    database: 'curriculum-portal',
    port: 3307, // Dockerのポートマッピング
    charset: 'utf8mb4'
};

async function checkUserAnnouncements() {
    let connection;
    try {
        console.log('=== ユーザーアナウンス関連付け確認 ===');
        
        // データベース接続
        connection = await mysql.createConnection(config);
        console.log('データベース接続成功');

        // 全ユーザーの一覧を取得
        const [users] = await connection.execute(`
            SELECT id, name, email, role 
            FROM user_accounts 
            WHERE role = 'student' 
            ORDER BY id
        `);
        
        console.log('\n=== 学生ユーザー一覧 ===');
        users.forEach(user => {
            console.log(`ID: ${user.id}, 名前: ${user.name}, メール: ${user.email}, 役割: ${user.role}`);
        });

        // 各ユーザーのアナウンス関連付けを確認
        console.log('\n=== 各ユーザーのアナウンス関連付け ===');
        for (const user of users) {
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
            `, [user.id]);
            
            console.log(`\nユーザーID ${user.id} (${user.name}):`);
            if (userAnnouncements.length === 0) {
                console.log('  アナウンスなし');
            } else {
                userAnnouncements.forEach(ua => {
                    console.log(`  - アナウンスID: ${ua.announcement_id}, タイトル: ${ua.title}, 既読: ${ua.is_read}`);
                });
            }
        }

        // アナウンスを作成して全学生に送信するテスト
        console.log('\n=== テストアナウンスの作成 ===');
        
        // 管理者ユーザーを取得
        const [adminUsers] = await connection.execute(`
            SELECT id FROM user_accounts WHERE role = 'admin' LIMIT 1
        `);
        
        if (adminUsers.length === 0) {
            console.log('管理者ユーザーが見つかりません');
            return;
        }
        
        const adminId = adminUsers[0].id;
        console.log(`管理者ID: ${adminId}`);
        
        // 新しいアナウンスを作成
        const [announcementResult] = await connection.execute(`
            INSERT INTO announcements (title, message, created_by, expires_at)
            VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))
        `, [
            'システムテスト用アナウンス',
            'これはシステムテスト用のアナウンスです。アナウンス機能の動作確認のために作成されました。',
            adminId
        ]);
        
        const announcementId = announcementResult.insertId;
        console.log(`新しいアナウンスを作成しました。ID: ${announcementId}`);
        
        // 全学生にアナウンスを関連付け
        const studentIds = users.map(user => user.id);
        if (studentIds.length > 0) {
            const placeholders = studentIds.map(() => '(?, ?)').join(', ');
            const values = [];
            studentIds.forEach(studentId => {
                values.push(announcementId, studentId);
            });
            
            await connection.execute(`
                INSERT INTO user_announcements (announcement_id, user_id)
                VALUES ${placeholders}
            `, values);
            
            console.log(`${studentIds.length}人の学生にアナウンスを関連付けました`);
        }

        // 再度確認
        console.log('\n=== 更新後の確認 ===');
        for (const user of users) {
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
            `, [user.id]);
            
            console.log(`ユーザーID ${user.id} (${user.name}): ${userAnnouncements.length}件のアナウンス`);
        }

    } catch (error) {
        console.error('エラー:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkUserAnnouncements();
