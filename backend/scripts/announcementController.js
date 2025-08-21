const db = require('../config/database');
const logger = require('../utils/logger');

class AnnouncementController {
    // 利用者のアナウンス一覧を取得
    static async getUserAnnouncements(req, res) {
        try {
            const { id: user_id } = req.user;
            const { page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;

            const query = `
                SELECT 
                    a.id,
                    a.title,
                    a.message,
                    a.created_at,
                    ua.name as created_by_name,
                    ua.is_read,
                    ua.read_at
                FROM announcements a
                JOIN user_announcements ua ON a.id = ua.announcement_id
                WHERE ua.user_id = ?
                ORDER BY a.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const [announcements] = await db.execute(query, [user_id, parseInt(limit), offset]);

            // 総件数を取得
            const [countResult] = await db.execute(
                'SELECT COUNT(*) as total FROM user_announcements WHERE user_id = ?',
                [user_id]
            );

            // 未読件数を取得
            const [unreadResult] = await db.execute(
                'SELECT COUNT(*) as unread FROM user_announcements WHERE user_id = ? AND is_read = 0',
                [user_id]
            );

            res.json({
                success: true,
                data: {
                    announcements: announcements,
                    pagination: {
                        current_page: parseInt(page),
                        total_pages: Math.ceil(countResult[0].total / limit),
                        total_count: countResult[0].total,
                        unread_count: unreadResult[0].unread,
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            logger.error('アナウンス一覧取得エラー:', error);
            res.status(500).json({
                success: false,
                message: 'アナウンス一覧の取得に失敗しました'
            });
        }
    }

    // アナウンスを既読にする
    static async markAsRead(req, res) {
        try {
            const { id: user_id } = req.user;
            const { announcement_id } = req.params;

            await db.execute(
                'UPDATE user_announcements SET is_read = 1, read_at = NOW() WHERE user_id = ? AND announcement_id = ?',
                [user_id, announcement_id]
            );

            res.json({
                success: true,
                message: 'アナウンスを既読にしました'
            });

        } catch (error) {
            logger.error('アナウンス既読エラー:', error);
            res.status(500).json({
                success: false,
                message: 'アナウンスの既読処理に失敗しました'
            });
        }
    }

    // 全アナウンスを既読にする
    static async markAllAsRead(req, res) {
        try {
            const { id: user_id } = req.user;

            await db.execute(
                'UPDATE user_announcements SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
                [user_id]
            );

            res.json({
                success: true,
                message: '全てのアナウンスを既読にしました'
            });

        } catch (error) {
            logger.error('全アナウンス既読エラー:', error);
            res.status(500).json({
                success: false,
                message: 'アナウンスの既読処理に失敗しました'
            });
        }
    }

    // 管理者用：アナウンス一覧を取得
    static async getAdminAnnouncements(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const query = `
                SELECT 
                    a.id,
                    a.title,
                    a.message,
                    a.created_at,
                    a.updated_at,
                    ua.name as created_by_name,
                    COUNT(ua2.user_id) as recipient_count,
                    COUNT(CASE WHEN ua2.is_read = 1 THEN 1 END) as read_count
                FROM announcements a
                LEFT JOIN user_accounts ua ON a.created_by = ua.id
                LEFT JOIN user_announcements ua2 ON a.id = ua2.announcement_id
                GROUP BY a.id
                ORDER BY a.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const [announcements] = await db.execute(query, [parseInt(limit), offset]);

            // 総件数を取得
            const [countResult] = await db.execute('SELECT COUNT(*) as total FROM announcements');

            res.json({
                success: true,
                data: {
                    announcements: announcements,
                    pagination: {
                        current_page: parseInt(page),
                        total_pages: Math.ceil(countResult[0].total / limit),
                        total_count: countResult[0].total,
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            logger.error('管理者アナウンス一覧取得エラー:', error);
            res.status(500).json({
                success: false,
                message: 'アナウンス一覧の取得に失敗しました'
            });
        }
    }

    // 管理者用：アナウンス詳細を取得
    static async getAnnouncementDetail(req, res) {
        try {
            const { announcement_id } = req.params;

            const query = `
                SELECT 
                    a.id,
                    a.title,
                    a.message,
                    a.created_at,
                    a.updated_at,
                    ua.name as created_by_name,
                    COUNT(ua2.user_id) as recipient_count,
                    COUNT(CASE WHEN ua2.is_read = 1 THEN 1 END) as read_count
                FROM announcements a
                LEFT JOIN user_accounts ua ON a.created_by = ua.id
                LEFT JOIN user_announcements ua2 ON a.id = ua2.announcement_id
                WHERE a.id = ?
                GROUP BY a.id
            `;

            const [announcements] = await db.execute(query, [announcement_id]);

            if (announcements.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'アナウンスが見つかりません'
                });
            }

            // 受信者一覧を取得
            const [recipients] = await db.execute(`
                SELECT 
                    ua.id,
                    ua.name,
                    ua.login_code,
                    c.name as company_name,
                    s.name as satellite_name,
                    ua2.is_read,
                    ua2.read_at
                FROM user_announcements ua2
                JOIN user_accounts ua ON ua2.user_id = ua.id
                LEFT JOIN companies c ON ua.company_id = c.id
                LEFT JOIN satellites s ON JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
                WHERE ua2.announcement_id = ?
                ORDER BY ua.name
            `, [announcement_id]);

            res.json({
                success: true,
                data: {
                    announcement: announcements[0],
                    recipients: recipients
                }
            });

        } catch (error) {
            logger.error('アナウンス詳細取得エラー:', error);
            res.status(500).json({
                success: false,
                message: 'アナウンス詳細の取得に失敗しました'
            });
        }
    }
}

module.exports = AnnouncementController;
