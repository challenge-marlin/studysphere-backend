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
            const { selected_instructor_id, selected_instructor_ids, satellite_id } = req.query;
            
            console.log('一時パスワード対象利用者取得リクエスト:', {
                user_id,
                role,
                selected_instructor_id,
                selected_instructor_ids,
                satellite_id,
                req_query: req.query
            });
            
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
                // デバッグ用：まず全ての利用者を確認
                console.log('管理者用デバッグ: 全ての利用者を確認');
                const [allUsers] = await pool.execute(`
                    SELECT 
                        ua.id,
                        ua.name,
                        ua.login_code,
                        ua.instructor_id,
                        ua.company_id,
                        ua.satellite_ids,
                        c.name as company_name
                    FROM user_accounts ua
                    LEFT JOIN companies c ON ua.company_id = c.id
                    WHERE ua.role = 1 
                    AND ua.status = 1
                    ${satellite_id ? 'AND JSON_CONTAINS(ua.satellite_ids, CAST(? AS JSON))' : ''}
                    ORDER BY ua.id
                    LIMIT 10
                `, satellite_id ? [satellite_id] : []);
                
                console.log('管理者用デバッグ: 全利用者数:', allUsers.length);
                console.log('管理者用デバッグ: 利用者サンプル:', allUsers.slice(0, 3));
                
                // 一時パスワード未発行の利用者を確認
                const [tempPasswordUsers] = await pool.execute(`
                    SELECT user_id, temp_password, expires_at, is_used
                    FROM user_temp_passwords 
                    WHERE expires_at > NOW()
                    AND is_used = 0
                    LIMIT 5
                `);
                console.log('管理者用デバッグ: 有効な一時パスワード数:', tempPasswordUsers.length);
                let query = `
                    SELECT 
                        ua.id,
                        ua.name,
                        ua.login_code,
                        ua.instructor_id,
                        ua.company_id,
                        ua.satellite_ids,
                        c.name as company_name,
                        NULL as satellite_name,
                        CASE 
                            WHEN ua.instructor_id IS NULL THEN 'no_instructor'
                            ELSE 'with_instructor'
                        END as user_type
                    FROM user_accounts ua
                    LEFT JOIN companies c ON ua.company_id = c.id
                    WHERE ua.role = 1 
                    AND ua.status = 1
                    ${satellite_id ? 'AND JSON_CONTAINS(ua.satellite_ids, CAST(? AS JSON))' : ''}
                    AND (
                        -- 一時パスワード未発行の場合
                        NOT EXISTS (
                            SELECT 1 FROM user_temp_passwords utp 
                            WHERE utp.user_id = ua.id 
                            AND utp.expires_at > NOW()
                            AND utp.is_used = 0
                        )
                        -- または、一時パスワードが発行されているが使用済みの場合
                        OR EXISTS (
                            SELECT 1 FROM user_temp_passwords utp 
                            WHERE utp.user_id = ua.id 
                            AND utp.expires_at > NOW()
                            AND utp.is_used = 1
                        )
                    )
                `;

                const params = [];
                if (satellite_id) {
                    params.push(satellite_id);
                }

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
                            NULL as satellite_name,
                            'selected_instructor' as user_type
                        FROM user_accounts ua
                        LEFT JOIN companies c ON ua.company_id = c.id
                        WHERE ua.role = 1 
                        AND ua.status = 1
                        AND ua.instructor_id IN (${placeholders})
                        ${satellite_id ? 'AND JSON_CONTAINS(ua.satellite_ids, CAST(? AS JSON))' : ''}
                        AND (
                            -- 一時パスワード未発行の場合
                            NOT EXISTS (
                                SELECT 1 FROM user_temp_passwords utp 
                                WHERE utp.user_id = ua.id 
                                AND utp.expires_at > NOW()
                                AND utp.is_used = 0
                            )
                            -- または、一時パスワードが発行されているが使用済みの場合
                            OR EXISTS (
                                SELECT 1 FROM user_temp_passwords utp 
                                WHERE utp.user_id = ua.id 
                                AND utp.expires_at > NOW()
                                AND utp.is_used = 1
                            )
                        )
                    `;
                    params.push(...selectedInstructorIds);
                    if (satellite_id) {
                        params.push(satellite_id);
                    }
                }

                query += ' ORDER BY user_type, name';

                const [users] = await pool.execute(query, params);
                
                console.log('管理者用一時パスワード対象利用者取得結果:', {
                    query: query.substring(0, 200) + '...',
                    params,
                    userCount: users.length,
                    users: users.slice(0, 3), // 最初の3件のみログ出力
                    satelliteId: satellite_id,
                    selectedInstructorIds: selectedInstructorIds
                });

                res.json({
                    success: true,
                    data: users
                });
                return;
            }

            // 指導員の場合は、1対1メッセージと同じロジックを使用
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

            // 現在のユーザーの企業・拠点情報を取得（1対1メッセージと同じロジック）
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
            let currentSatelliteIds = currentUser.satellite_ids ? JSON.parse(currentUser.satellite_ids) : [];

            // フロントエンドから送信された拠点IDがある場合は、それを使用
            if (satellite_id) {
                console.log('Using satellite_id from frontend for temp password users:', satellite_id);
                currentSatelliteIds = [parseInt(satellite_id)];
            }

            // WHERE条件を構築（1対1メッセージと同じロジック）
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

            // フロントエンドから送信された拠点IDがある場合は、直接拠点情報を取得
            let satelliteJoin = '';
            let satelliteSelect = 'NULL as satellite_name';
            
            if (satellite_id) {
                satelliteJoin = 'LEFT JOIN satellites s ON s.id = ?';
                satelliteSelect = 's.name as satellite_name';
                queryParams.unshift(parseInt(satellite_id)); // 先頭に追加
            } else {
                satelliteJoin = `LEFT JOIN satellites s ON (
                    s.id IS NOT NULL AND ua.satellite_ids IS NOT NULL AND (
                        JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(s.id)) OR 
                        JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                        JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                    )
                )`;
            }

            // 一時パスワード未発行の条件を追加
            whereConditions.push(`(
                -- 一時パスワード未発行の場合
                NOT EXISTS (
                    SELECT 1 FROM user_temp_passwords utp 
                    WHERE utp.user_id = ua.id 
                    AND utp.expires_at > NOW()
                    AND utp.is_used = 0
                )
                -- または、一時パスワードが発行されているが使用済みの場合
                OR EXISTS (
                    SELECT 1 FROM user_temp_passwords utp 
                    WHERE utp.user_id = ua.id 
                    AND utp.expires_at > NOW()
                    AND utp.is_used = 1
                )
            )`);

            // 利用者一覧を取得（自分の担当利用者を優先表示、1対1メッセージと同じロジック + 一時パスワード条件）
            let query = `
                SELECT 
                    ua.id,
                    ua.name,
                    ua.email,
                    ua.login_code,
                    ua.instructor_id,
                    ${satelliteSelect},
                    c.name as company_name,
                    instructor.name as instructor_name,
                    CASE WHEN ua.instructor_id = ? THEN 1 ELSE 0 END as is_my_assigned,
                    GROUP_CONCAT(ut.tag_name) as tags
                FROM user_accounts ua
                ${satelliteJoin}
                LEFT JOIN companies c ON ua.company_id = c.id
                LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
                LEFT JOIN user_tags ut ON ua.id = ut.user_id
                WHERE ${whereConditions.join(' AND ')}
                GROUP BY ua.id, ua.name, ua.email, ua.login_code, ua.instructor_id, s.name, c.name, instructor.name
            `;

            const params = [user_id, ...queryParams];

            // 選択された指導員の利用者も含める場合のUNIONクエリを追加
            if (selectedInstructorIds.length > 0) {
                const placeholders = selectedInstructorIds.map(() => '?').join(',');
                query += `
                    UNION
                    SELECT 
                        ua.id,
                        ua.name,
                        ua.email,
                        ua.login_code,
                        ua.instructor_id,
                        ${satelliteSelect},
                        c.name as company_name,
                        instructor.name as instructor_name,
                        CASE WHEN ua.instructor_id IN (${placeholders}) THEN 1 ELSE 0 END as is_my_assigned,
                        GROUP_CONCAT(ut.tag_name) as tags
                    FROM user_accounts ua
                    ${satelliteJoin}
                    LEFT JOIN companies c ON ua.company_id = c.id
                    LEFT JOIN user_accounts instructor ON ua.instructor_id = instructor.id
                    LEFT JOIN user_tags ut ON ua.id = ut.user_id
                    WHERE ${whereConditions.join(' AND ')}
                    AND ua.instructor_id IN (${placeholders})
                    GROUP BY ua.id, ua.name, ua.email, ua.login_code, ua.instructor_id, s.name, c.name, instructor.name
                `;
                params.push(...selectedInstructorIds);
                params.push(...selectedInstructorIds);
            }

            // UNIONクエリの後にORDER BY句を追加
            query += ' ORDER BY is_my_assigned DESC, name ASC';

            console.log('実行するSQLクエリ:', query);
            console.log('パラメータ:', params);
            console.log('パラメータ数:', params.length);

            const [users] = await pool.execute(query, params);
            
            console.log('一時パスワード対象利用者取得結果:', {
                query: query.substring(0, 200) + '...',
                params,
                userCount: users.length,
                users: users.slice(0, 3) // 最初の3件のみログ出力
            });

            res.json({
                success: true,
                data: users
            });

        } catch (error) {
            console.error('一時パスワード対象利用者取得エラー詳細:', error);
            customLogger.error('一時パスワード対象利用者取得エラー:', error);
            res.status(500).json({
                success: false,
                message: '利用者一覧の取得に失敗しました',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // 一時パスワードを一括発行
    static async issueTempPasswords(req, res) {
        let connection;
        try {
            const { user_ids, expiry_time, announcement_title, announcement_message } = req.body;
            const { user_id: admin_id, username: admin_name } = req.user;

            if (!user_ids || user_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '利用者が選択されていません'
                });
            }

            // トランザクション開始
            connection = await pool.getConnection();
            await connection.beginTransaction();

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
                const [announcementResult] = await connection.execute(
                    'INSERT INTO announcements (title, message, created_by) VALUES (?, ?, ?)',
                    [announcement_title, announcement_message, admin_id]
                );
                announcement_id = announcementResult.insertId;

                // 選択された利用者にアナウンスを関連付け
                const userAnnouncementValues = user_ids.map(user_id => [user_id, announcement_id]);
                const placeholders = userAnnouncementValues.map(() => '(?, ?)').join(',');
                const flatValues = userAnnouncementValues.flat();
                
                await connection.execute(
                    `INSERT INTO user_announcements (user_id, announcement_id) VALUES ${placeholders}`,
                    flatValues
                );
            }

            // 一時パスワードを発行
            const tempPasswords = [];
            for (const user_id of user_ids) {
                // 既存の一時パスワードを無効化
                await connection.execute(
                    'UPDATE user_temp_passwords SET is_used = 1 WHERE user_id = ? AND is_used = 0',
                    [user_id]
                );
                
                const tempPassword = TempPasswordController.generateTempPassword();
                
                // デバッグ情報を追加
                const formattedExpiryDate = formatMySQLDateTime(expiryDate);
                customLogger.info(`Issuing temp password for user ${user_id}: ${tempPassword}`);
                customLogger.info(`Expiry date details: original=${expiryDate}, formatted=${formattedExpiryDate}, type=${typeof formattedExpiryDate}`);
                
                // フォーマットされた日付が有効かチェック
                if (!formattedExpiryDate || formattedExpiryDate === 'Invalid Date') {
                    throw new Error(`Invalid formatted expiry date: ${formattedExpiryDate}`);
                }
                
                await connection.execute(
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
            await connection.execute(
                'INSERT INTO operation_logs (admin_id, admin_name, action, details) VALUES (?, ?, ?, ?)',
                [
                    admin_id,
                    admin_name,
                    '一時パスワード一括発行',
                    `対象利用者数: ${user_ids.length}, 有効期限: ${expiryDate.toLocaleString('ja-JP')}${announcement_id ? ', アナウンス送信あり' : ''}`
                ]
            );

            // トランザクションコミット
            await connection.commit();

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
            // トランザクションロールバック
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    customLogger.error('ロールバックエラー:', rollbackError);
                }
            }
            
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
        } finally {
            // 接続を解放
            if (connection) {
                try {
                    connection.release();
                } catch (releaseError) {
                    customLogger.error('接続解放エラー:', releaseError);
                }
            }
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
            
            // 有効期限情報を返す（フロントエンドでチェック）
            res.json({
                success: true,
                data: {
                    hasValidPassword: true, // フロントエンドで期限チェックを行うため常にtrue
                    tempPassword: tempPassword.temp_password,
                    expiresAt: tempPassword.expires_at,
                    issuedAt: tempPassword.issued_at,
                    message: '一時パスワード情報を取得しました'
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
            
            console.log('指導員一覧取得リクエスト:', { user_id, role, satellite_id: req.query.satellite_id });
            
            // シンプルなクエリに修正
            let query = `
                SELECT 
                    ua.id,
                    ua.name,
                    ua.email,
                    ua.company_id,
                    ua.satellite_ids,
                    c.name as company_name
                FROM user_accounts ua
                LEFT JOIN companies c ON ua.company_id = c.id
                WHERE ua.role = 4 
                AND ua.status = 1
            `;
            
            const params = [];
            
            // 拠点での絞り込みを追加
            if (req.query.satellite_id) {
                query += ` AND (
                    ua.satellite_ids IS NOT NULL 
                    AND ua.satellite_ids != 'null' 
                    AND ua.satellite_ids != '[]'
                    AND (
                        JSON_CONTAINS(ua.satellite_ids, CAST(? AS JSON)) OR
                        JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(?)) OR
                        JSON_SEARCH(ua.satellite_ids, 'one', ?) IS NOT NULL
                    )
                )`;
                params.push(req.query.satellite_id, req.query.satellite_id, req.query.satellite_id);
            }
            
            // 指導員の場合は自分自身を除外
            if (role === 4 || role === 5) {
                query += ` AND ua.id != ?`;
                params.push(user_id);
            }
            
            query += ` ORDER BY ua.name`;

            console.log('実行するクエリ:', query);
            console.log('パラメータ:', params);

            const [instructors] = await pool.execute(query, params);
            
            console.log('指導員一覧取得結果:', {
                instructorCount: instructors.length,
                instructors: instructors.slice(0, 3) // 最初の3件のみログ出力
            });

            res.json({
                success: true,
                data: instructors
            });

        } catch (error) {
            console.error('指導員一覧取得エラー詳細:', error);
            customLogger.error('指導員一覧取得エラー:', error);
            res.status(500).json({
                success: false,
                message: '指導員一覧の取得に失敗しました',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
                      JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(CAST(s.id AS CHAR))) OR 
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
                  s.id IS NOT NULL AND ua.satellite_ids IS NOT NULL AND (
                    JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(CAST(s.id AS CHAR))) OR 
                    JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                    JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                  )
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
                                let instructorSatelliteIds = instructor.satellite_ids;
                                
                                // JSON文字列の場合はパース
                                if (typeof instructorSatelliteIds === 'string') {
                                    instructorSatelliteIds = JSON.parse(instructorSatelliteIds);
                                }
                                
                                // 配列でない場合はfalse
                                if (!Array.isArray(instructorSatelliteIds)) {
                                    return false;
                                }
                                
                                // 数値として比較
                                return instructorSatelliteIds.includes(satellite.id) || 
                                       instructorSatelliteIds.includes(satellite.id.toString());
                            } catch (error) {
                                customLogger.error('指導員拠点ID処理エラー:', error);
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
            const { selected_companies, selected_satellites, selected_instructors, satellite_id } = req.query;
            
            // パラメータを配列に変換
            const companyIds = selected_companies ? (Array.isArray(selected_companies) ? selected_companies : [selected_companies]) : [];
            let satelliteIds = selected_satellites ? (Array.isArray(selected_satellites) ? selected_satellites : [selected_satellites]) : [];
            const instructorIds = selected_instructors ? (Array.isArray(selected_instructors) ? selected_instructors : [selected_instructors]) : [];
            
            // フロントエンドから送信された拠点IDがある場合は、それを使用
            if (satellite_id) {
                console.log('Using satellite_id from frontend for temp passwords:', satellite_id);
                satelliteIds = [satellite_id];
            }
            
            // 担当者IDから'none'を除外して実際のIDのみを取得
            const actualInstructorIds = instructorIds.filter(id => id !== 'none');
            const hasNoneInstructor = instructorIds.includes('none');
            
            // 初期状態（選択条件なし）の場合は、担当なし＋自担当の利用者を表示
            const isInitialState = companyIds.length === 0 && satelliteIds.length === 0 && instructorIds.length === 0;

            // フロントエンドから送信された拠点IDがある場合は、直接拠点情報を取得
            let satelliteJoin = '';
            let satelliteSelect = 'NULL as satellite_name';
            
            if (satellite_id) {
                satelliteJoin = 'LEFT JOIN satellites s ON s.id = ?';
                satelliteSelect = 's.name as satellite_name';
            } else {
                satelliteJoin = `LEFT JOIN satellites s ON (
                    s.id IS NOT NULL AND ua.satellite_ids IS NOT NULL AND (
                        JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(CAST(s.id AS CHAR))) OR 
                        JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
                        JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
                    )
                )`;
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
                    ${satelliteSelect},
                    CASE 
                        WHEN ua.instructor_id IS NULL THEN 'no_instructor'
                        ${actualInstructorIds.length > 0 ? `WHEN ua.instructor_id IN (${actualInstructorIds.map(() => '?').join(',')}) THEN 'selected_instructor'` : ''}
                        ELSE 'other_instructor'
                    END as user_type
                FROM user_accounts ua
                LEFT JOIN companies c ON ua.company_id = c.id
                ${satelliteJoin}
                WHERE ua.role = 1 
                AND ua.status = 1
                AND (
                    ${isInitialState ? 
                        // 初期状態：担当なし＋自担当の利用者
                        `(ua.instructor_id IS NULL OR ua.instructor_id = ?)` :
                        // 選択条件ありの場合
                        `${companyIds.length > 0 ? 'ua.company_id IN (' + companyIds.map(() => '?').join(',') + ')' : '1=1'}
                        ${satelliteIds.length > 0 ? ' AND JSON_CONTAINS(ua.satellite_ids, JSON_ARRAY(' + satelliteIds.map(() => '?').join(',') + '))' : ''}
                        ${actualInstructorIds.length > 0 ? ' AND ua.instructor_id IN (' + actualInstructorIds.map(() => '?').join(',') + ')' : ''}
                        ${hasNoneInstructor ? ' AND ua.instructor_id IS NULL' : ''}`
                    }
                )
                AND (
                    -- 一時パスワード未発行の場合
                    NOT EXISTS (
                        SELECT 1 FROM user_temp_passwords utp 
                        WHERE utp.user_id = ua.id 
                        AND utp.expires_at > NOW()
                        AND utp.is_used = 0
                    )
                    -- または、一時パスワードが発行されているが使用済みの場合
                    OR EXISTS (
                        SELECT 1 FROM user_temp_passwords utp 
                        WHERE utp.user_id = ua.id 
                        AND utp.expires_at > NOW()
                        AND utp.is_used = 1
                    )
                )
            `;

            const params = [];
            
            // フロントエンドから送信された拠点IDがある場合は、先頭に追加
            if (satellite_id) {
                params.unshift(parseInt(satellite_id));
            }
            
            if (isInitialState) {
                // 初期状態：自担当の指導員IDを追加
                params.push(user_id);
            } else {
                // 選択条件ありの場合
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
