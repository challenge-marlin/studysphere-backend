const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');
const { 
  getCurrentJapanTime, 
  getTodayEndTime, 
  convertUTCToJapanTime, 
  convertJapanTimeToUTC,
  isExpired,
  formatJapanTime,
  formatMySQLDateTime,
  getJapanTimeFromString
} = require('../utils/dateUtils');

class TempPasswordController {
    // 利用者一覧を取得（自分の担当利用者 + 一時パスワード未発行の担当なし利用者）
    static async getUsersForTempPassword(req, res) {
        try {
            const { user_id, role } = req.user;
            const { selected_instructor_id, selected_instructor_ids } = req.query;
            
            // 複数の指導員IDを処理
            let selectedInstructorIds = [];
            if (selected_instructor_ids) {
                // 配列として送信された場合
                if (Array.isArray(selected_instructor_ids)) {
                    selectedInstructorIds = selected_instructor_ids;
                } else {
                    // 単一の値として送信された場合
                    selectedInstructorIds = [selected_instructor_ids];
                }
            } else if (selected_instructor_id) {
                // 後方互換性のため
                selectedInstructorIds = [selected_instructor_id];
            }
            
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
                    LEFT JOIN satellites s ON (
                      JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                      JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                      JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                    )
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
                if (selectedInstructorIds.length > 0) {
                    const placeholders = selectedInstructorIds.map(() => '?').join(',');
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
                        LEFT JOIN satellites s ON (
                      JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                      JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                      JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                    )
                        WHERE ua.role = 1 
                        AND ua.status = 1
                        AND ua.instructor_id IN (${placeholders})
                        AND NOT EXISTS (
                            SELECT 1 FROM user_temp_passwords utp 
                            WHERE utp.user_id = ua.id 
                            AND utp.expires_at > NOW()
                            AND utp.is_used = 0
                        )
                    `;
                    params.push(...selectedInstructorIds);
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
                LEFT JOIN satellites s ON (
                  JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                  JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                  JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                )
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
            if (selectedInstructorIds.length > 0) {
                const placeholders = selectedInstructorIds.map(() => '?').join(',');
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
                    LEFT JOIN satellites s ON (
                      JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                      JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                      JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                    )
                    WHERE ua.role = 1 
                    AND ua.status = 1
                    AND ua.instructor_id IN (${placeholders})
                    AND NOT EXISTS (
                        SELECT 1 FROM user_temp_passwords utp 
                        WHERE utp.user_id = ua.id 
                        AND utp.expires_at > NOW()
                        AND utp.is_used = 0
                    )
                `;
                params.push(...selectedInstructorIds);
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
            const { user_id: admin_id, username: admin_name } = req.user;

            if (!user_ids || user_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '利用者が選択されていません'
                });
            }

            // 有効期限を計算
            const now = new Date();
            let expiryDate;
            let japanEndTime;
            
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
                // デフォルトは今日の23:59（日本時間）
                // 日本時間の今日の23:59:59を直接計算
                const japanNow = new Date();
                const japanOffset = 9 * 60; // 日本時間はUTC+9
                
                // 日本時間の今日の23:59:59を計算
                const japanToday = new Date(japanNow.getTime() + (japanOffset * 60 * 1000));
                japanToday.setHours(23, 59, 59, 999);
                
                // UTCに変換して返す（データベース保存用）
                expiryDate = new Date(japanToday.getTime() - (japanOffset * 60 * 1000));
                
                console.log('=== 一括発行デバッグ（デフォルト時間） ===');
                console.log('現在時刻 (UTC):', japanNow);
                console.log('日本時間の今日23:59:59 (UTC):', expiryDate);
                console.log('expiryDate.toISOString():', expiryDate.toISOString());
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
                const placeholders = userAnnouncementValues.map(() => '(?, ?)').join(',');
                const flatValues = userAnnouncementValues.flat();
                
                await pool.execute(
                    `INSERT INTO user_announcements (user_id, announcement_id) VALUES ${placeholders}`,
                    flatValues
                );
            }

            // 一時パスワードを発行
            const tempPasswords = [];
            for (const user_id of user_ids) {
                const tempPassword = TempPasswordController.generateTempPassword();
                
                // デバッグ情報を追加
                const formattedExpiryDate = formatMySQLDateTime(expiryDate);
                customLogger.info(`Issuing temp password for user ${user_id}: ${tempPassword}`);
                customLogger.info(`Expiry date details: original=${expiryDate}, formatted=${formattedExpiryDate}, type=${typeof formattedExpiryDate}`);
                
                // フォーマットされた日付が有効かチェック
                if (!formattedExpiryDate || formattedExpiryDate === 'Invalid Date') {
                    throw new Error(`Invalid formatted expiry date: ${formattedExpiryDate}`);
                }
                
                await pool.execute(
                    'INSERT INTO user_temp_passwords (user_id, temp_password, expires_at) VALUES (?, ?, ?)',
                    [user_id, tempPassword, formattedExpiryDate]
                );

                // 日本時間の文字列を生成
                const japanTimeString = expiryDate.toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: 'Asia/Tokyo'
                });
                
                tempPasswords.push({
                    user_id,
                    temp_password: tempPassword,
                    expires_at: japanTimeString
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

            // 日本時間の文字列を生成
            const japanTimeString = expiryDate.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Asia/Tokyo'
            });
            
            res.json({
                success: true,
                message: `${user_ids.length}名の利用者に一時パスワードを発行しました`,
                data: {
                    temp_passwords: tempPasswords,
                    expiry_at: japanTimeString,
                    announcement_id: announcement_id
                }
            });

        } catch (error) {
            customLogger.error('一時パスワード発行エラー:', error);
            customLogger.error('エラー詳細:', {
                message: error.message,
                stack: error.stack,
                code: error.code,
                sqlState: error.sqlState
            });
            res.status(500).json({
                success: false,
                message: '一時パスワードの発行に失敗しました',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    // 一時パスワード状態確認
    static async checkTempPasswordStatus(req, res) {
        try {
            const { login_code } = req.params;
            
            if (!login_code) {
                return res.status(400).json({
                    success: false,
                    message: 'ログインコードが必須です'
                });
            }

            // ユーザーと一時パスワードの状態を確認
            const [rows] = await pool.execute(`
                SELECT 
                    ua.id,
                    ua.name,
                    ua.role,
                    utp.temp_password,
                    utp.expires_at,
                    utp.is_used,
                    utp.issued_at
                FROM user_accounts ua
                LEFT JOIN user_temp_passwords utp ON ua.id = utp.user_id
                WHERE ua.login_code = ?
                AND utp.expires_at > NOW()
                AND utp.is_used = 0
                ORDER BY utp.issued_at DESC
                LIMIT 1
            `, [login_code]);

            if (rows.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        hasValidPassword: false,
                        message: '有効な一時パスワードがありません'
                    }
                });
            }

            const tempPassword = rows[0];
            
            // 日本時間での有効期限チェック
            const isValid = !isExpired(tempPassword.expires_at);

            res.json({
                success: true,
                data: {
                    hasValidPassword: isValid,
                    tempPassword: isValid ? tempPassword.temp_password : null,
                    expiresAt: tempPassword.expires_at,
                    issuedAt: tempPassword.issued_at,
                    message: isValid ? '有効な一時パスワードがあります' : '一時パスワードの有効期限が切れています'
                }
            });

        } catch (error) {
            customLogger.error('一時パスワード状態確認エラー:', error);
            res.status(500).json({
                success: false,
                message: '一時パスワード状態の確認に失敗しました'
            });
        }
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
                    LEFT JOIN satellites s ON (
                      JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                      JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                      JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                    )
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
                LEFT JOIN satellites s ON (
                  JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                  JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                  JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                )
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

    // 企業・拠点・担当者の階層構造を取得
    static async getHierarchyData(req, res) {
        try {
            const { user_id, role } = req.user;
            
            // 企業一覧を取得
            const [companies] = await pool.execute(`
                SELECT 
                    c.id,
                    c.name
                FROM companies c
                ORDER BY c.name
            `);

            // 拠点一覧を取得
            const [satellites] = await pool.execute(`
                SELECT 
                    s.id,
                    s.company_id,
                    s.name
                FROM satellites s
                WHERE s.status = 1
                ORDER BY s.name
            `);

            // 担当者一覧を取得（指導員）
            const [instructors] = await pool.execute(`
                SELECT 
                    ua.id,
                    ua.name,
                    ua.company_id,
                    ua.satellite_ids
                FROM user_accounts ua
                WHERE ua.role = 4 
                AND ua.status = 1
                ORDER BY ua.name
            `);

            // 階層構造を構築
            const hierarchy = companies.map(company => {
                const companySatellites = satellites.filter(s => s.company_id === company.id);
                const companyInstructors = instructors.filter(i => i.company_id === company.id);
                
                return {
                    id: company.id,
                    name: company.name,
                    type: 'company',
                    satellites: companySatellites.map(satellite => {
                        const satelliteInstructors = companyInstructors.filter(instructor => {
                            try {
                                const instructorSatelliteIds = instructor.satellite_ids;
                                return Array.isArray(instructorSatelliteIds) && instructorSatelliteIds.includes(satellite.id.toString());
                            } catch (error) {
                                return false;
                            }
                        });
                        
                        return {
                            id: satellite.id,
                            name: satellite.name,
                            type: 'satellite',
                            company_id: company.id,
                            instructors: satelliteInstructors.map(instructor => ({
                                id: instructor.id,
                                name: instructor.name,
                                type: 'instructor',
                                company_id: company.id,
                                satellite_id: satellite.id
                            }))
                        };
                    })
                };
            });

            res.json({
                success: true,
                data: hierarchy
            });

        } catch (error) {
            customLogger.error('階層データ取得エラー:', error);
            res.status(500).json({
                success: false,
                message: '階層データの取得に失敗しました'
            });
        }
    }

    // 選択された企業・拠点・担当者に基づいて利用者を取得
    static async getUsersByHierarchy(req, res) {
        try {
            const { user_id, role } = req.user;
            const { selected_companies, selected_satellites, selected_instructors } = req.query;
            
            // パラメータを配列に変換
            const companyIds = selected_companies ? (Array.isArray(selected_companies) ? selected_companies : [selected_companies]) : [];
            const satelliteIds = selected_satellites ? (Array.isArray(selected_satellites) ? selected_satellites : [selected_satellites]) : [];
            const instructorIds = selected_instructors ? (Array.isArray(selected_instructors) ? selected_instructors : [selected_instructors]) : [];
            
            // 担当者IDから'none'を除外して実際のIDのみを取得
            const actualInstructorIds = instructorIds.filter(id => id !== 'none');
            const hasNoneInstructor = instructorIds.includes('none');

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
                        WHEN ua.instructor_id IS NULL THEN 'no_instructor'
                        WHEN ua.instructor_id IN (${actualInstructorIds.length > 0 ? actualInstructorIds.map(() => '?').join(',') : 'NULL'}) THEN 'selected_instructor'
                        ELSE 'other_instructor'
                    END as user_type
                FROM user_accounts ua
                LEFT JOIN companies c ON ua.company_id = c.id
                LEFT JOIN satellites s ON (
                  JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                  JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                  JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                )
                WHERE ua.role = 1 
                AND ua.status = 1
                AND (
                    ${companyIds.length > 0 ? 'ua.company_id IN (' + companyIds.map(() => '?').join(',') + ')' : '1=1'}
                    ${satelliteIds.length > 0 ? 'AND JSON_CONTAINS(ua.satellite_ids, JSON_ARRAY(' + satelliteIds.map(() => '?').join(',') + '))' : ''}
                    ${actualInstructorIds.length > 0 ? 'AND ua.instructor_id IN (' + actualInstructorIds.map(() => '?').join(',') + ')' : ''}
                    ${hasNoneInstructor ? 'AND ua.instructor_id IS NULL' : ''}
                )
                AND NOT EXISTS (
                    SELECT 1 FROM user_temp_passwords utp 
                    WHERE utp.user_id = ua.id 
                    AND utp.expires_at > NOW()
                    AND utp.is_used = 0
                )
            `;

            const params = [];
            if (companyIds.length > 0) {
                params.push(...companyIds);
            }
            if (satelliteIds.length > 0) {
                params.push(...satelliteIds);
            }
            if (actualInstructorIds.length > 0) {
                params.push(...actualInstructorIds);
            }
            if (hasNoneInstructor) {
                // hasNoneInstructorの場合はパラメータを追加しない（条件はua.instructor_id IS NULL）
            }

            query += ' ORDER BY user_type, company_name, satellite_name, name';

            const [users] = await pool.execute(query, params);

            res.json({
                success: true,
                data: users
            });

        } catch (error) {
            customLogger.error('階層別利用者取得エラー:', error);
            res.status(500).json({
                success: false,
                message: '利用者一覧の取得に失敗しました'
            });
        }
    }
}

module.exports = TempPasswordController;
