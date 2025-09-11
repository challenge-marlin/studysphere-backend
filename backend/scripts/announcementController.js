const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');

class AnnouncementController {
    // 利用者のアナウンス一覧を取得
    static async getUserAnnouncements(req, res) {
        try {
            const { user_id } = req.user;
            const { page = 1, limit = 10 } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);

            customLogger.debug('アナウンス一覧取得パラメータ:', {
                user_id,
                page: pageNum,
                limit: limitNum
            });

            // 現在はアナウンスデータが存在しないため、空の結果を返す
            customLogger.debug('アナウンス機能は準備中です');
            res.json({
                success: true,
                data: {
                    announcements: [],
                    pagination: {
                        current_page: pageNum,
                        total_pages: 0,
                        total_count: 0,
                        unread_count: 0,
                        limit: limitNum
                    }
                }
            });

        } catch (error) {
            customLogger.error('アナウンス一覧取得エラー:', error);
            res.status(500).json({
                success: false,
                message: 'アナウンス一覧の取得に失敗しました'
            });
        }
    }

    // アナウンスを既読にする
    static async markAsRead(req, res) {
        try {
            const { user_id } = req.user;
            const { announcement_id } = req.params;

            await pool.execute(
                'UPDATE user_announcements SET is_read = 1, read_at = NOW() WHERE user_id = ? AND announcement_id = ?',
                [user_id, announcement_id]
            );

            res.json({
                success: true,
                message: 'アナウンスを既読にしました'
            });

        } catch (error) {
            customLogger.error('アナウンス既読エラー:', error);
            res.status(500).json({
                success: false,
                message: 'アナウンスの既読処理に失敗しました'
            });
        }
    }

    // 全アナウンスを既読にする
    static async markAllAsRead(req, res) {
        try {
            const { user_id } = req.user;

            await pool.execute(
                'UPDATE user_announcements SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
                [user_id]
            );

            res.json({
                success: true,
                message: '全てのアナウンスを既読にしました'
            });

        } catch (error) {
            customLogger.error('全アナウンス既読エラー:', error);
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

            const [announcements] = await pool.execute(query, [parseInt(limit), offset]);

            // 総件数を取得
            const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM announcements');

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
            customLogger.error('管理者アナウンス一覧取得エラー:', error);
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

            const [announcements] = await pool.execute(query, [announcement_id]);

            if (announcements.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'アナウンスが見つかりません'
                });
            }

            // 受信者一覧を取得
            const [recipients] = await pool.execute(`
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
            customLogger.error('アナウンス詳細取得エラー:', error);
            res.status(500).json({
                success: false,
                message: 'アナウンス詳細の取得に失敗しました'
            });
        }
    }

    // 管理者用：アナウンス作成
    static async createAnnouncement(req, res) {
        try {
            const { title, message, recipient_ids } = req.body;
            const created_by = req.user.user_id;

            // バリデーション
            if (!title || !message || !recipient_ids || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'タイトル、メッセージ、受信者IDは必須です'
                });
            }

            if (title.trim().length === 0 || message.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'タイトルとメッセージ内容が空です'
                });
            }

            // 受信者の存在確認
            const placeholders = recipient_ids.map(() => '?').join(',');
            const [recipients] = await pool.execute(
                `SELECT id, name FROM user_accounts WHERE id IN (${placeholders}) AND status = 1`,
                recipient_ids
            );

            if (recipients.length !== recipient_ids.length) {
                return res.status(400).json({
                    success: false,
                    message: '無効な受信者が含まれています'
                });
            }

            // トランザクション開始
            await pool.execute('START TRANSACTION');

            try {
                // 有効期限を設定（日本時間の翌日24:30）
                const now = new Date();
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 30, 0, 0); // 24:30（翌日の0:30）
                
                // アナウンス作成
                const [announcementResult] = await pool.execute(
                    'INSERT INTO announcements (title, message, created_by, expires_at) VALUES (?, ?, ?, ?)',
                    [title.trim(), message.trim(), created_by, tomorrow]
                );

                const announcement_id = announcementResult.insertId;

                // 受信者との関連付けを作成
                const recipientValues = recipient_ids.map(user_id => [announcement_id, user_id]);
                const recipientPlaceholders = recipientValues.map(() => '(?, ?)').join(',');
                const recipientParams = recipientValues.flat();

                await pool.execute(
                    `INSERT INTO user_announcements (announcement_id, user_id) VALUES ${recipientPlaceholders}`,
                    recipientParams
                );

                // トランザクションコミット
                await pool.execute('COMMIT');

                // 作成者情報を取得
                const [creatorRows] = await pool.execute(
                    'SELECT id, name, role FROM user_accounts WHERE id = ?',
                    [created_by]
                );

                res.status(201).json({
                    success: true,
                    message: 'アナウンスを作成しました',
                    data: {
                        id: announcement_id,
                        title: title.trim(),
                        message: message.trim(),
                        created_by: creatorRows[0],
                        recipients: recipients,
                        created_at: new Date()
                    }
                });

            } catch (error) {
                // トランザクションロールバック
                await pool.execute('ROLLBACK');
                throw error;
            }

        } catch (error) {
            customLogger.error('アナウンス作成エラー:', error);
            res.status(500).json({
                success: false,
                message: 'アナウンスの作成に失敗しました'
            });
        }
    }

    // 管理者用：利用者一覧取得（アナウンス送信用）
    static async getUsersForAnnouncement(req, res) {
        try {
            const { role, satellite_id, company_id } = req.query;
            const current_user = req.user;

            let whereConditions = ['ua.status = 1'];
            let queryParams = [];

            // ロールフィルタ
            if (role) {
                whereConditions.push('ua.role = ?');
                queryParams.push(parseInt(role));
            }

            // 拠点フィルタ
            if (satellite_id) {
                whereConditions.push('JSON_CONTAINS(ua.satellite_ids, ?)');
                queryParams.push(JSON.stringify(parseInt(satellite_id)));
            }

            // 企業フィルタ
            if (company_id) {
                whereConditions.push('ua.company_id = ?');
                queryParams.push(parseInt(company_id));
            }

            // 指導員の場合は担当する利用者のみ
            if (current_user.role === 4) {
                whereConditions.push('ua.instructor_id = ?');
                queryParams.push(current_user.user_id);
            }

            const query = `
                SELECT 
                    ua.id,
                    ua.name,
                    ua.email,
                    ua.login_code,
                    ua.role,
                    c.name as company_name,
                    s.name as satellite_name,
                    instructor.name as instructor_name
                FROM user_accounts ua
                LEFT JOIN companies c ON ua.company_id = c.id
                LEFT JOIN satellites s ON JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
                LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY ua.name
            `;

            const [users] = await pool.execute(query, queryParams);

            res.json({
                success: true,
                data: users
            });

        } catch (error) {
            customLogger.error('利用者一覧取得エラー:', error);
            res.status(500).json({
                success: false,
                message: '利用者一覧の取得に失敗しました'
            });
        }
    }
}

module.exports = AnnouncementController;
