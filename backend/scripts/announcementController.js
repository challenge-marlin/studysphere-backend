const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');

// サニタイズ関数
const sanitizeInput = (input) => {
    if (typeof input !== 'string') {
        return String(input);
    }
    
    let sanitized = input;
    
    // 1. スクリプトとイベントハンドラーを除去
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    // 2. HTMLタグを除去
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    // 3. 特殊文字をエスケープ
    const htmlEscapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    sanitized = sanitized.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
    
    // 4. 連続する空白を単一の空白に正規化
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    // 5. 前後の空白を除去
    sanitized = sanitized.trim();
    
    return sanitized;
};

class AnnouncementController {
    // 利用者のアナウンス一覧を取得
    static async getUserAnnouncements(req, res) {
        try {
            const { user_id } = req.user;

            customLogger.debug('アナウンス一覧取得パラメータ:', {
                user_id
            });

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

            const [announcements] = await pool.execute(query, [user_id]);
            const [unreadResult] = await pool.execute(unreadQuery, [user_id]);

            const unreadCount = unreadResult[0].unread_count;

            customLogger.debug('アナウンス一覧取得結果:', {
                unread_count: unreadCount,
                announcements_count: announcements.length
            });

            res.json({
                success: true,
                data: {
                    announcements: announcements,
                    pagination: {
                        total_count: announcements.length,
                        unread_count: unreadCount
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
            const { user_id, role } = req.user;
            const { selected_satellite_id } = req.query; // 現在選択中の拠点ID
            customLogger.debug('管理者アナウンス一覧取得開始', { user_id, role, selected_satellite_id });

            // まずテーブルの存在確認
            const [tableCheck] = await pool.execute("SHOW TABLES LIKE 'announcements'");
            if (tableCheck.length === 0) {
                customLogger.warn('announcementsテーブルが存在しません');
                return res.json({
                    success: true,
                    data: {
                        announcements: [],
                        pagination: {
                            current_page: 1,
                            total_pages: 0,
                            total_count: 0,
                            limit: 0
                        }
                    }
                });
            }

            let query;
            let queryParams = [];

            if (role >= 5) {
                // ロール5以上：選択中の企業・拠点で送信したアナウンスメッセージを閲覧可能
                customLogger.debug('ロール5以上：企業・拠点フィルタリング適用');
                
                // 現在のユーザーの企業・拠点情報を取得
                const [currentUserRows] = await pool.execute(`
                    SELECT 
                        ua.company_id,
                        ua.satellite_ids
                    FROM user_accounts ua
                    WHERE ua.id = ? AND ua.status = 1
                `, [user_id]);

                if (currentUserRows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'ユーザー情報が見つかりません'
                    });
                }

                const currentUser = currentUserRows[0];
                const currentCompanyId = currentUser.company_id;
                const currentSatelliteIds = currentUser.satellite_ids ? JSON.parse(currentUser.satellite_ids) : [];

                customLogger.debug('現在のユーザー企業・拠点情報:', { currentCompanyId, currentSatelliteIds });

                // 企業・拠点フィルタリング用のクエリ
                query = `
                    SELECT 
                        a.id,
                        a.title,
                        a.message,
                        a.created_at,
                        a.updated_at,
                        ua.name as created_by_name,
                        ua.company_id as created_by_company_id,
                        ua.satellite_ids as created_by_satellite_ids,
                        COUNT(ua2.user_id) as recipient_count,
                        COUNT(CASE WHEN ua2.is_read = 1 THEN 1 END) as read_count
                    FROM announcements a
                    LEFT JOIN user_accounts ua ON a.created_by = ua.id
                    LEFT JOIN user_announcements ua2 ON a.id = ua2.announcement_id
                    WHERE 1=1
                `;

                // 企業フィルタリング
                if (currentCompanyId) {
                    query += ` AND ua.company_id = ?`;
                    queryParams.push(currentCompanyId);
                }

                // 拠点フィルタリング：選択中の拠点に所属する利用者に送信されたアナウンスを表示
                if (selected_satellite_id) {
                    // 選択中の拠点IDが指定されている場合は、その拠点に所属する利用者に送信されたアナウンスのみ表示
                    customLogger.debug('選択中の拠点IDでフィルタリング:', selected_satellite_id);
                    query += ` AND EXISTS (
                        SELECT 1 FROM user_announcements ua3 
                        JOIN user_accounts ua4 ON ua3.user_id = ua4.id 
                        WHERE ua3.announcement_id = a.id 
                        AND JSON_CONTAINS(ua4.satellite_ids, ?)
                    )`;
                    queryParams.push(JSON.stringify(parseInt(selected_satellite_id)));
                } else if (currentSatelliteIds.length > 0) {
                    // 選択中の拠点IDが指定されていない場合は、ユーザーの所属拠点に所属する利用者に送信されたアナウンスを表示
                    customLogger.debug('ユーザー所属拠点でフィルタリング:', currentSatelliteIds);
                    query += ` AND EXISTS (
                        SELECT 1 FROM user_announcements ua3 
                        JOIN user_accounts ua4 ON ua3.user_id = ua4.id 
                        WHERE ua3.announcement_id = a.id 
                        AND JSON_OVERLAPS(ua4.satellite_ids, ?)
                    )`;
                    queryParams.push(JSON.stringify(currentSatelliteIds));
                }

                query += ` GROUP BY a.id ORDER BY a.created_at DESC`;

            } else {
                // ロール4以下：自身の送ったアナウンスメッセージのみ閲覧可能
                customLogger.debug('ロール4以下：自身の送信アナウンスのみ表示');
                
                query = `
                    SELECT 
                        a.id,
                        a.title,
                        a.message,
                        a.created_at,
                        a.updated_at,
                        ua.name as created_by_name,
                        ua.company_id as created_by_company_id,
                        ua.satellite_ids as created_by_satellite_ids,
                        COUNT(ua2.user_id) as recipient_count,
                        COUNT(CASE WHEN ua2.is_read = 1 THEN 1 END) as read_count
                    FROM announcements a
                    LEFT JOIN user_accounts ua ON a.created_by = ua.id
                    LEFT JOIN user_announcements ua2 ON a.id = ua2.announcement_id
                    WHERE a.created_by = ?
                    GROUP BY a.id
                    ORDER BY a.created_at DESC
                `;
                queryParams.push(user_id);
            }

            customLogger.debug('アナウンス一覧クエリ実行', { query, queryParams });
            const [announcements] = await pool.execute(query, queryParams);

            customLogger.debug('アナウンス一覧取得成功:', { count: announcements.length });

            res.json({
                success: true,
                data: {
                    announcements: announcements,
                    pagination: {
                        current_page: 1,
                        total_pages: 1,
                        total_count: announcements.length,
                        limit: announcements.length
                    }
                }
            });

        } catch (error) {
            customLogger.error('管理者アナウンス一覧取得エラー:', error);
            customLogger.error('エラー詳細:', {
                message: error.message,
                stack: error.stack,
                code: error.code
            });
            res.status(500).json({
                success: false,
                message: 'アナウンス一覧の取得に失敗しました',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
                LEFT JOIN satellites s ON (
                  JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                  JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                  JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                )
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

            // トランザクション処理用の接続を取得
            const connection = await pool.getConnection();
            
            try {
                // トランザクション開始
                await connection.beginTransaction();

                // 有効期限を設定（日本時間の翌日24:30）
                const now = new Date();
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 30, 0, 0); // 24:30（翌日の0:30）
                
                // アナウンス作成（サニタイズ処理を追加）
                const sanitizedTitle = sanitizeInput(title.trim());
                const sanitizedMessage = sanitizeInput(message.trim());
                const [announcementResult] = await connection.execute(
                    'INSERT INTO announcements (title, message, created_by, expires_at) VALUES (?, ?, ?, ?)',
                    [sanitizedTitle, sanitizedMessage, created_by, tomorrow]
                );

                const announcement_id = announcementResult.insertId;

                // 受信者との関連付けを作成
                const recipientValues = recipient_ids.map(user_id => [announcement_id, user_id]);
                const recipientPlaceholders = recipientValues.map(() => '(?, ?)').join(',');
                const recipientParams = recipientValues.flat();

                await connection.execute(
                    `INSERT INTO user_announcements (announcement_id, user_id) VALUES ${recipientPlaceholders}`,
                    recipientParams
                );

                // トランザクションコミット
                await connection.commit();

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
                        title: sanitizedTitle,
                        message: sanitizedMessage,
                        created_by: creatorRows[0],
                        recipients: recipients,
                        created_at: new Date()
                    }
                });

            } catch (error) {
                // トランザクションロールバック
                await connection.rollback();
                throw error;
            } finally {
                // 接続をプールに返す
                connection.release();
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
            const { 
                instructor_filter = 'all', // 'my', 'other', 'none', 'all', 'specific'
                instructor_ids = '', // 特定の指導員IDをカンマ区切りで指定
                name_filter = '',
                tag_filter = ''
            } = req.query;
            const current_user = req.user;


            // 現在のユーザーの企業・拠点情報を取得（管理者・指導員共通）
            let currentCompanyId = null;
            let currentSatelliteIds = [];
            
            console.log('Getting current user info for user_id:', current_user.user_id);
            const [currentUserRows] = await pool.execute(`
                SELECT 
                    ua.company_id,
                    ua.satellite_ids
                FROM user_accounts ua
                WHERE ua.id = ? AND ua.status = 1
            `, [current_user.user_id]);

            console.log('Current user rows:', currentUserRows);

            if (currentUserRows.length > 0) {
                const currentUser = currentUserRows[0];
                currentCompanyId = currentUser.company_id;
                currentSatelliteIds = currentUser.satellite_ids ? JSON.parse(currentUser.satellite_ids) : [];
                console.log('Current user company/satellite info:', { currentCompanyId, currentSatelliteIds });
            } else {
                console.log('No current user found for user_id:', current_user.user_id);
            }

            // WHERE条件を構築
            let whereConditions = ['ua.role = 1', 'ua.status = 1'];
            let queryParams = [];

            // 企業・拠点フィルタ（現在選択中の企業・拠点に所属するロール1ユーザのみ）
            if (currentCompanyId) {
                whereConditions.push('ua.company_id = ?');
                queryParams.push(currentCompanyId);
            }

            if (currentSatelliteIds.length > 0) {
                whereConditions.push('JSON_OVERLAPS(ua.satellite_ids, ?)');
                queryParams.push(JSON.stringify(currentSatelliteIds));
            }

            // 担当指導員フィルタ（管理者・指導員共通）
            switch (instructor_filter) {
                case 'my':
                    whereConditions.push('ua.instructor_id = ?');
                    queryParams.push(current_user.user_id);
                    break;
                case 'other':
                    whereConditions.push('ua.instructor_id IS NOT NULL AND ua.instructor_id != ?');
                    queryParams.push(current_user.user_id);
                    break;
                case 'specific':
                    if (instructor_ids) {
                        const instructorIdList = instructor_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                        if (instructorIdList.length > 0) {
                            const placeholders = instructorIdList.map(() => '?').join(',');
                            whereConditions.push(`ua.instructor_id IN (${placeholders})`);
                            queryParams.push(...instructorIdList);
                        }
                    }
                    break;
                case 'none':
                    whereConditions.push('ua.instructor_id IS NULL');
                    break;
                case 'all':
                default:
                    // 条件なし
                    break;
            }

            // 名前フィルタ
            if (name_filter) {
                whereConditions.push('ua.name LIKE ?');
                queryParams.push(`%${name_filter}%`);
            }

            // タグフィルタ
            if (tag_filter) {
                whereConditions.push('EXISTS (SELECT 1 FROM user_tags ut WHERE ut.user_id = ua.id AND ut.tag_name LIKE ?)');
                queryParams.push(`%${tag_filter}%`);
            }

            const query = `
                SELECT 
                    ua.id,
                    ua.name,
                    ua.email,
                    ua.login_code,
                    ua.role,
                    ua.instructor_id,
                    c.name as company_name,
                    s.name as satellite_name,
                    instructor.name as instructor_name,
                    CASE WHEN ua.instructor_id = ? THEN 1 ELSE 0 END as is_my_assigned,
                    GROUP_CONCAT(ut.tag_name) as tags
                FROM user_accounts ua
                LEFT JOIN companies c ON ua.company_id = c.id
                LEFT JOIN satellites s ON (
                  JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                  JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                  JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                )
                LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
                LEFT JOIN user_tags ut ON ua.id = ut.user_id
                WHERE ${whereConditions.join(' AND ')}
                GROUP BY ua.id, ua.name, ua.email, ua.login_code, ua.role, ua.instructor_id, c.name, s.name, instructor.name
                ORDER BY is_my_assigned DESC, ua.name ASC
            `;

            console.log('Executing query:', query);
            console.log('Query params:', [current_user.user_id, ...queryParams]);
            
            const [users] = await pool.execute(query, [current_user.user_id, ...queryParams]);
            
            console.log('Query result count:', users.length);

            res.json({
                success: true,
                data: users
            });

        } catch (error) {
            customLogger.error('利用者一覧取得エラー:', error);
            console.error('Announcement getUsersForAnnouncement error:', error);
            res.status(500).json({
                success: false,
                message: '利用者一覧の取得に失敗しました',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // 拠点の指導員一覧取得（フィルター用）
    static async getInstructorsForFilter(req, res) {
        try {
            const user_id = req.user.user_id;
            const user_role = req.user.role;

            // 管理者（ロール5以上）または指導員（ロール4）のみアクセス可能
            if (user_role < 4) {
                return res.status(403).json({
                    success: false,
                    message: '管理者または指導員のみアクセス可能です'
                });
            }

            // 現在のユーザーの企業・拠点情報を取得
            const [currentUserRows] = await pool.execute(`
                SELECT 
                    ua.company_id,
                    ua.satellite_ids
                FROM user_accounts ua
                WHERE ua.id = ? AND ua.status = 1
            `, [user_id]);

            if (currentUserRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'ユーザー情報が見つかりません'
                });
            }

            const currentUser = currentUserRows[0];
            const currentCompanyId = currentUser.company_id;
            const currentSatelliteIds = currentUser.satellite_ids ? JSON.parse(currentUser.satellite_ids) : [];

            // 同じ拠点の他の指導員一覧を取得
            let whereConditions = ['ua.role = 4', 'ua.status = 1', 'ua.id != ?'];
            let queryParams = [user_id];

            if (currentCompanyId) {
                whereConditions.push('ua.company_id = ?');
                queryParams.push(currentCompanyId);
            }

            if (currentSatelliteIds.length > 0) {
                whereConditions.push('JSON_OVERLAPS(ua.satellite_ids, ?)');
                queryParams.push(JSON.stringify(currentSatelliteIds));
            }

            const [instructors] = await pool.execute(`
                SELECT 
                    ua.id,
                    ua.name,
                    s.name as satellite_name,
                    c.name as company_name
                FROM user_accounts ua
                LEFT JOIN satellites s ON (
                  JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                  JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                  JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                )
                LEFT JOIN companies c ON ua.company_id = c.id
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY ua.name ASC
            `, queryParams);

            res.json({
                success: true,
                data: instructors
            });

        } catch (error) {
            customLogger.error('指導員一覧取得エラー:', error);
            console.error('Announcement getInstructorsForFilter error:', error);
            res.status(500).json({
                success: false,
                message: '指導員一覧の取得に失敗しました',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = AnnouncementController;
