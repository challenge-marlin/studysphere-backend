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

async function testAnnouncements() {
    let connection;
    try {
        console.log('=== アナウンスデータテスト開始 ===');
        
        // データベース接続
        connection = await mysql.createConnection(config);
        console.log('データベース接続成功');

        // アナウンステーブルの存在確認
        const [tables] = await connection.execute("SHOW TABLES LIKE 'announcements'");
        console.log('announcementsテーブル:', tables.length > 0 ? '存在' : '不存在');

        const [userAnnouncementsTables] = await connection.execute("SHOW TABLES LIKE 'user_announcements'");
        console.log('user_announcementsテーブル:', userAnnouncementsTables.length > 0 ? '存在' : '不存在');

        // アナウンスデータの確認
        const [announcements] = await connection.execute("SELECT COUNT(*) as count FROM announcements");
        console.log('アナウンス総数:', announcements[0].count);

        // 有効なアナウンスの確認
        const [activeAnnouncements] = await connection.execute("SELECT COUNT(*) as count FROM announcements WHERE expires_at > NOW()");
        console.log('有効なアナウンス数:', activeAnnouncements[0].count);

        // ユーザーアナウンス関連付けの確認
        const [userAnnouncements] = await connection.execute("SELECT COUNT(*) as count FROM user_announcements");
        console.log('ユーザーアナウンス関連付け数:', userAnnouncements[0].count);

        // サンプルデータの表示
        const [sampleAnnouncements] = await connection.execute(`
            SELECT 
                a.id,
                a.title,
                a.message,
                a.created_at,
                a.expires_at,
                a.created_by
            FROM announcements a
            WHERE a.expires_at > NOW()
            ORDER BY a.created_at DESC
            LIMIT 5
        `);
        
        console.log('\n=== 有効なアナウンスサンプル ===');
        sampleAnnouncements.forEach((ann, index) => {
            console.log(`${index + 1}. ID: ${ann.id}, タイトル: ${ann.title}, 作成者: ${ann.created_by}, 有効期限: ${ann.expires_at}`);
        });

        // ユーザーアナウンス関連付けのサンプル
        const [sampleUserAnnouncements] = await connection.execute(`
            SELECT 
                ua.user_id,
                ua.announcement_id,
                ua.is_read,
                a.title
            FROM user_announcements ua
            JOIN announcements a ON ua.announcement_id = a.id
            WHERE a.expires_at > NOW()
            LIMIT 5
        `);
        
        console.log('\n=== ユーザーアナウンス関連付けサンプル ===');
        sampleUserAnnouncements.forEach((ua, index) => {
            console.log(`${index + 1}. ユーザーID: ${ua.user_id}, アナウンスID: ${ua.announcement_id}, 既読: ${ua.is_read}, タイトル: ${ua.title}`);
        });

        // 特定のユーザー（例：ID=1）のアナウンス確認
        const [user1Announcements] = await connection.execute(`
            SELECT 
                a.id,
                a.title,
                a.message,
                a.created_at,
                a.expires_at,
                ua.name as created_by_name,
                ua2.is_read,
                ua2.read_at
            FROM announcements a
            JOIN user_announcements ua2 ON a.id = ua2.announcement_id
            LEFT JOIN user_accounts ua ON a.created_by = ua.id
            WHERE ua2.user_id = 1 
            AND a.expires_at > NOW()
            ORDER BY a.created_at DESC
        `);
        
        console.log('\n=== ユーザーID=1のアナウンス ===');
        console.log('件数:', user1Announcements.length);
        user1Announcements.forEach((ann, index) => {
            console.log(`${index + 1}. ${ann.title} (既読: ${ann.is_read})`);
        });

    } catch (error) {
        console.error('エラー:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

testAnnouncements();
