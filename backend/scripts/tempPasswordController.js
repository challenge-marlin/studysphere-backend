const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');

class TempPasswordController {
    // 利用者一覧を取得（自分の担当利用者 + 一時パスワード未発行の担当なし利用者）
    static async getUsersForTempPassword(req, res) {
        try {
            const { user_id, role } = req.user;
            const { selected_instructor_id } = req.query;
            
            // 指導員の場合、user_idをinstructor_idとして使用
            const instructor_id = role === 4 || role === 5 ? user_id : null;

            // 管理者の場合は、担当なしでパスワード未発行の利用者を取得
            if (role === 9) {
                let query = `
                    SELECT 
                        ua.id,
                        ua.name,
                        ua.login_code,
                        ua.instructor_id,
                        ua.company_id,
                        ua.satellite_ids,
                        c.name as company_name,
                        s.name as satellite_name,
                        'no_instructor' as user_type
                    FROM user_accounts ua
                    LEFT JOIN companies c ON ua.company_id = c.id
                    LEFT JOIN satellites s ON JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
                    WHERE ua.role = 1 
                    AND ua.status = 1
                    AND ua.instructor_id IS NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM user_temp_passwords utp 
                        WHERE utp.user_id = ua.id 
                        AND utp.expires_at > NOW()
                        AND utp.is_used = 0
                    )
                `;

                const params = [];

                // 別担当者を選択した場合、その指導員のパスワード未発行担当利用者も追加
                if (selected_instructor_id) {
                    query += `
                        UNION
                        SELECT 
                            ua.id,
                            ua.name,
                            ua.login_code,
                            ua.instructor_id,
                            ua.company_id,
                            ua.satellite_ids,
                            c.name as company_name,
                            s.name as satellite_name,
                            'selected_instructor' as user_type
                        FROM user_accounts ua
                        LEFT JOIN companies c ON ua.company_id = c.id
                        LEFT JOIN satellites s ON JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
                        WHERE ua.role = 1 
                        AND ua.status = 1
                        AND ua.instructor_id = ?
                        AND NOT EXISTS (
                            SELECT 1 FROM user_temp_passwords utp 
                            WHERE utp.user_id = ua.id 
                            AND utp.expires_at > NOW()
                            AND utp.is_used = 0
                        )
                    `;
                    params.push(selected_instructor_id);
                }

                query += ' ORDER BY user_type, name';

                const [users] = await pool.execute(query, params);

                res.json({
                    success: true,
                    data: users
                });
                return;
            }

            // 指導員の場合は、従来の処理
            if (role === 4 || role === 5) {
                if (!instructor_id) {
                    return res.status(400).json({
                        success: false,
                        message: '指導員IDが設定されていません'
                    });
                }
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'この機能にアクセスする権限がありません'
                });
            }

            let query = `
                SELECT 
                    ua.id,
                    ua.name,
                    ua.login_code,
                    ua.instructor_id,
                    ua.company_id,
                    ua.satellite_ids,
                    c.name as company_name,
                    s.name as satellite_name,
                    CASE 
                        WHEN ua.instructor_id = ? THEN 'my_user'
                        WHEN ua.instructor_id IS NULL AND NOT EXISTS (
                            SELECT 1 FROM user_temp_passwords utp 
                            WHERE utp.user_id = ua.id 
                            AND utp.expires_at > NOW()
                            AND utp.is_used = 0
                        ) THEN 'no_instructor_no_temp'
                        ELSE 'other'
                    END as user_type
                FROM user_accounts ua
                LEFT JOIN companies c ON ua.company_id = c.id
                LEFT JOIN satellites s ON JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
                WHERE ua.role = 1 
                AND ua.status = 1
                AND (
                    ua.instructor_id = ? 
                    OR (ua.instructor_id IS NULL AND NOT EXISTS (
                        SELECT 1 FROM user_temp_passwords utp 
                        WHERE utp.user_id = ua.id 
                        AND utp.expires_at > NOW()
                        AND utp.is_used = 0
                    ))
                )
            `;

            const params = [instructor_id, instructor_id];

            // 別担当者を選択した場合、その指導員のパスワード未発行担当利用者も追加
            if (selected_instructor_id && selected_instructor_id !== instructor_id) {
                query += `
                    UNION
                    SELECT 
                        ua.id,
                        ua.name,
                        ua.login_code,
                        ua.instructor_id,
                        ua.company_id,
                        ua.satellite_ids,
                        c.name as company_name,
                        s.name as satellite_name,
                        'selected_instructor' as user_type
                    FROM user_accounts ua
                    LEFT JOIN companies c ON ua.company_id = c.id
                    LEFT JOIN satellites s ON JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
                    WHERE ua.role = 1 
                    AND ua.status = 1
                    AND ua.instructor_id = ?
                    AND NOT EXISTS (
                        SELECT 1 FROM user_temp_passwords utp 
                        WHERE utp.user_id = ua.id 
                        AND utp.expires_at > NOW()
                        AND utp.is_used = 0
                    )
                `;
                params.push(selected_instructor_id);
            }

            query += ' ORDER BY user_type, name';

            const [users] = await pool.execute(query, params);

            res.json({
                success: true,
                data: users
            });

        } catch (error) {
            customLogger.error('一時パスワード対象利用者取得エラー:', error);
            res.status(500).json({
                success: false,
                message: '利用者一覧の取得に失敗しました'
            });
        }
    }

    // 一時パスワードを一括発行
    static async issueTempPasswords(req, res) {
        try {
            const { user_ids, expiry_time, announcement_title, announcement_message } = req.body;
            const { id: admin_id, name: admin_name } = req.user;

            if (!user_ids || user_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '利用者が選択されていません'
                });
            }

            // 有効期限を計算
            const now = new Date();
            let expiryDate;
            
            if (expiry_time) {
                // HH:DD形式の時間を解析
                const timeMatch = expiry_time.match(/^(\d{1,2}):(\d{2})$/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    
                    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                        expiryDate = new Date(now);
                        expiryDate.setHours(hours, minutes, 59, 999);
                        
                        // 過去の時間の場合は翌日に設定
                        if (expiryDate <= now) {
                            expiryDate.setDate(expiryDate.getDate() + 1);
                        }
                    } else {
                        return res.status(400).json({
                            success: false,
                            message: '有効時間の形式が正しくありません（HH:DD形式で入力してください）'
                        });
                    }
                } else {
                    return res.status(400).json({
                        success: false,
                        message: '有効時間の形式が正しくありません（HH:DD形式で入力してください）'
                    });
                }
            } else {
                // デフォルトは今日の23:59
                expiryDate = new Date(now);
                expiryDate.setHours(23, 59, 59, 999);
            }

            // アナウンスメッセージを作成（指定された場合）
            let announcement_id = null;
            if (announcement_title && announcement_message) {
                const [announcementResult] = await pool.execute(
                    'INSERT INTO announcements (title, message, created_by) VALUES (?, ?, ?)',
                    [announcement_title, announcement_message, admin_id]
                );
                announcement_id = announcementResult.insertId;

                // 選択された利用者にアナウンスを関連付け
                const userAnnouncementValues = user_ids.map(user_id => [user_id, announcement_id]);
                await pool.execute(
                    'INSERT INTO user_announcements (user_id, announcement_id) VALUES ?',
                    [userAnnouncementValues]
                );
            }

            // 一時パスワードを発行
            const tempPasswords = [];
            for (const user_id of user_ids) {
                const tempPassword = this.generateTempPassword();
                
                customLogger.info(`Issuing temp password for user ${user_id}: ${tempPassword}, expires at: ${expiryDate}`);
                
                await pool.execute(
                    'INSERT INTO user_temp_passwords (user_id, temp_password, expires_at) VALUES (?, ?, ?)',
                    [user_id, tempPassword, expiryDate]
                );

                tempPasswords.push({
                    user_id,
                    temp_password: tempPassword,
                    expires_at: expiryDate
                });
            }

            // 操作ログを記録
            await pool.execute(
                'INSERT INTO operation_logs (admin_id, admin_name, action, details) VALUES (?, ?, ?, ?)',
                [
                    admin_id,
                    admin_name,
                    '一時パスワード一括発行',
                    `対象利用者数: ${user_ids.length}, 有効期限: ${expiryDate.toLocaleString('ja-JP')}${announcement_id ? ', アナウンス送信あり' : ''}`
                ]
            );

            res.json({
                success: true,
                message: `${user_ids.length}名の利用者に一時パスワードを発行しました`,
                data: {
                    temp_passwords: tempPasswords,
                    expiry_at: expiryDate,
                    announcement_id: announcement_id
                }
            });

        } catch (error) {
            customLogger.error('一時パスワード発行エラー:', error);
            res.status(500).json({
                success: false,
                message: '一時パスワードの発行に失敗しました'
            });
        }
    }

    // 一時パスワードを生成（XXXX-XXXX形式）
    static generateTempPassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        
        // 最初の4文字
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        result += '-';
        
        // 後半の4文字
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return result;
    }

    // 指導員一覧を取得
    static async getInstructors(req, res) {
        try {
            const { user_id, role } = req.user;
            
            // 指導員の場合、自分自身を除外
            let query = `
                SELECT 
                    ua.id,
                    ua.name,
                    ua.email,
                    ua.company_id,
                    c.name as company_name
                FROM user_accounts ua
                LEFT JOIN companies c ON ua.company_id = c.id
                WHERE ua.role = 4 
                AND ua.status = 1
            `;
            
            const params = [];
            
            // 指導員の場合は自分自身を除外
            if (role === 4 || role === 5) {
                query += ` AND ua.id != ?`;
                params.push(user_id);
            }
            
            query += ` ORDER BY ua.name`;

            const [instructors] = await pool.execute(query, params);

            res.json({
                success: true,
                data: instructors
            });

        } catch (error) {
            customLogger.error('指導員一覧取得エラー:', error);
            res.status(500).json({
                success: false,
                message: '指導員一覧の取得に失敗しました'
            });
        }
    }

    // 一時パスワード一覧を取得
    static async getTempPasswords(req, res) {
        try {
            const { instructor_id, role } = req.user;
            const { page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            // 管理者の場合は、すべての一時パスワードを取得
            if (role === 9) {
                const query = `
                    SELECT 
                        utp.id,
                        utp.temp_password,
                        utp.issued_at,
                        utp.expires_at,
                        utp.is_used,
                        utp.used_at,
                        ua.id as user_id,
                        ua.name as user_name,
                        ua.login_code,
                        c.name as company_name,
                        s.name as satellite_name
                    FROM user_temp_passwords utp
                    JOIN user_accounts ua ON utp.user_id = ua.id
                    LEFT JOIN companies c ON ua.company_id = c.id
                    LEFT JOIN satellites s ON JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
                    ORDER BY utp.issued_at DESC
                    LIMIT ? OFFSET ?
                `;

                const [tempPasswords] = await pool.execute(query, [parseInt(limit), offset]);

                // 総件数を取得
                const [countResult] = await pool.execute(
                    'SELECT COUNT(*) as total FROM user_temp_passwords utp JOIN user_accounts ua ON utp.user_id = ua.id'
                );

                res.json({
                    success: true,
                    data: {
                        temp_passwords: tempPasswords,
                        pagination: {
                            current_page: parseInt(page),
                            total_pages: Math.ceil(countResult[0].total / limit),
                            total_count: countResult[0].total,
                            limit: parseInt(limit)
                        }
                    }
                });
                return;
            }

            // 指導員の場合は、従来の処理
            if (!instructor_id) {
                return res.status(400).json({
                    success: false,
                    message: '指導員IDが設定されていません'
                });
            }

            const query = `
                SELECT 
                    utp.id,
                    utp.temp_password,
                    utp.issued_at,
                    utp.expires_at,
                    utp.is_used,
                    utp.used_at,
                    ua.id as user_id,
                    ua.name as user_name,
                    ua.login_code,
                    c.name as company_name,
                    s.name as satellite_name
                FROM user_temp_passwords utp
                JOIN user_accounts ua ON utp.user_id = ua.id
                LEFT JOIN companies c ON ua.company_id = c.id
                LEFT JOIN satellites s ON JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
                WHERE ua.instructor_id = ?
                ORDER BY utp.issued_at DESC
                LIMIT ? OFFSET ?
            `;

            const [tempPasswords] = await pool.execute(query, [instructor_id, parseInt(limit), offset]);

            // 総件数を取得
            const [countResult] = await pool.execute(
                'SELECT COUNT(*) as total FROM user_temp_passwords utp JOIN user_accounts ua ON utp.user_id = ua.id WHERE ua.instructor_id = ?',
                [instructor_id]
            );

            res.json({
                success: true,
                data: {
                    temp_passwords: tempPasswords,
                    pagination: {
                        current_page: parseInt(page),
                        total_pages: Math.ceil(countResult[0].total / limit),
                        total_count: countResult[0].total,
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            customLogger.error('一時パスワード一覧取得エラー:', error);
            res.status(500).json({
                success: false,
                message: '一時パスワード一覧の取得に失敗しました'
            });
        }
    }
}

module.exports = TempPasswordController;
