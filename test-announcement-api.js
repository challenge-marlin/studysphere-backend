const mysql = require('mysql2/promise');

const config = {
    host: 'localhost',
    user: 'root',
    password: 'shinomoto926!',
    database: 'curriculum-portal',
    port: 3307,
    charset: 'utf8mb4'
};

// プールを作成
const pool = mysql.createPool(config);

// アナウンスコントローラーのロジックを再現
async function getUserAnnouncements(userId) {
    try {
        console.log('アナウンス一覧取得パラメータ:', { user_id: userId });

        // 利用者に送信されたアナウンス一覧を取得（ページネーションなし）
        const query = `
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
            WHERE ua2.user_id = ? 
            AND a.expires_at > NOW()
            ORDER BY a.created_at DESC
        `;

        // 未読件数を取得
        const unreadQuery = `
            SELECT COUNT(*) as unread_count
            FROM announcements a
            JOIN user_announcements ua2 ON a.id = ua2.announcement_id
            WHERE ua2.user_id = ? 
            AND a.expires_at > NOW()
            AND ua2.is_read = 0
        `;

        const [announcements] = await pool.execute(query, [userId]);
        const [unreadResult] = await pool.execute(unreadQuery, [userId]);

        const unreadCount = unreadResult[0].unread_count;

        console.log('アナウンス一覧取得結果:', {
            unread_count: unreadCount,
            announcements_count: announcements.length
        });

        return {
            success: true,
            data: {
                announcements: announcements,
                pagination: {
                    total_count: announcements.length,
                    unread_count: unreadCount
                }
            }
        };

    } catch (error) {
        console.error('アナウンス一覧取得エラー:', error);
        return {
            success: false,
            message: 'アナウンス一覧の取得に失敗しました'
        };
    }
}

async function testAPI() {
    try {
        console.log('=== アナウンスAPIテスト開始 ===');
        
        // ユーザーID 98（原田　幸輝）でテスト
        const result = await getUserAnnouncements(98);
        
        console.log('\n=== API結果 ===');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.success && result.data.announcements.length > 0) {
            console.log('\n=== アナウンス詳細 ===');
            result.data.announcements.forEach((ann, index) => {
                console.log(`${index + 1}. ID: ${ann.id}`);
                console.log(`   タイトル: ${ann.title}`);
                console.log(`   メッセージ: ${ann.message}`);
                console.log(`   作成者: ${ann.created_by_name}`);
                console.log(`   作成日時: ${ann.created_at}`);
                console.log(`   有効期限: ${ann.expires_at}`);
                console.log(`   既読: ${ann.is_read}`);
                console.log(`   既読日時: ${ann.read_at}`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('テストエラー:', error);
    } finally {
        await pool.end();
    }
}

testAPI();
