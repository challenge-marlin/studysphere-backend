const express = require('express');
const router = express.Router();
const { pool } = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');
const {
  sendPushNotificationToUser,
  pushNotificationsConfigured,
} = require('../utils/pushNotifications');

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

const truncateForNotification = (text, maxLength = 120) => {
  if (!text) {
    return '';
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
};

// 個人メッセージ送信
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { receiver_id, message } = req.body;
    const sender_id = req.user.user_id;

    // バリデーション
    if (!receiver_id || !message) {
      return res.status(400).json({
        success: false,
        message: '受信者IDとメッセージ内容は必須です'
      });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'メッセージ内容が空です'
      });
    }

    // 受信者の存在確認
    const [receiverRows] = await pool.execute(
      'SELECT id, name, role FROM user_accounts WHERE id = ? AND status = 1',
      [receiver_id]
    );

    if (receiverRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '受信者が見つかりません'
      });
    }

    // 有効期限を設定（日本時間の翌日24:30）
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 30, 0, 0); // 24:30（翌日の0:30）
    
    // メッセージ送信（サニタイズ処理を追加）
    const sanitizedMessage = sanitizeInput(message.trim());
    const [result] = await pool.execute(
      'INSERT INTO personal_messages (sender_id, receiver_id, message, expires_at) VALUES (?, ?, ?, ?)',
      [sender_id, receiver_id, sanitizedMessage, tomorrow]
    );

    // 送信者と受信者の情報を取得
    const [senderRows] = await pool.execute(
      'SELECT id, name, role FROM user_accounts WHERE id = ?',
      [sender_id]
    );

    const responsePayload = {
      id: result.insertId,
      sender: senderRows[0],
      receiver: receiverRows[0],
      message: sanitizedMessage,
      created_at: new Date()
    };

    if (pushNotificationsConfigured()) {
      const senderName = senderRows[0]?.name || '新着メッセージ';
      const receiverRole = receiverRows[0]?.role;
      let targetUrl = '/';
      if (receiverRole === 1) {
        targetUrl = '/student/dashboard';
      } else if (receiverRole === 4) {
        targetUrl = '/instructor/dashboard';
      } else if (receiverRole === 5) {
        targetUrl = '/admin/dashboard';
      }

      try {
        await sendPushNotificationToUser(receiver_id, {
          title: 'Study Sphere',
          body: `${senderName}: ${truncateForNotification(sanitizedMessage, 120)}`,
          url: targetUrl,
        });
      } catch (pushError) {
        console.error('Failed to dispatch push notification:', pushError);
      }
    }

    res.status(201).json({
      success: true,
      message: 'メッセージを送信しました',
      data: responsePayload
    });

  } catch (error) {
    console.error('メッセージ送信エラー:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージの送信に失敗しました'
    });
  }
});

// 個人メッセージ一覧取得（送信者・受信者別）
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;

    // ユーザーとの会話相手一覧を取得（期限切れのメッセージは除外）
    const [conversations] = await pool.execute(`
      SELECT DISTINCT
        CASE 
          WHEN sender_id = ? THEN receiver_id 
          ELSE sender_id 
        END as other_user_id,
        u.name as other_user_name,
        u.role as other_user_role,
        MAX(pm.created_at) as last_message_at,
        COUNT(CASE WHEN pm.receiver_id = ? AND pm.is_read = 0 THEN 1 END) as unread_count
      FROM personal_messages pm
      JOIN user_accounts u ON (
        CASE 
          WHEN pm.sender_id = ? THEN pm.receiver_id 
          ELSE pm.sender_id 
        END = u.id
      )
      WHERE (pm.sender_id = ? OR pm.receiver_id = ?)
        AND pm.expires_at > CONVERT_TZ(NOW(), '+00:00', '+09:00')
      GROUP BY other_user_id, u.name, u.role
      ORDER BY last_message_at DESC
    `, [user_id, user_id, user_id, user_id, user_id]);

    res.json({
      success: true,
      data: conversations
    });

  } catch (error) {
    console.error('会話一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '会話一覧の取得に失敗しました'
    });
  }
});

// 特定ユーザーとのメッセージ履歴取得
router.get('/conversation/:other_user_id', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const other_user_id = parseInt(req.params.other_user_id);

    if (isNaN(other_user_id)) {
      return res.status(400).json({
        success: false,
        message: '無効なユーザーIDです'
      });
    }

    // メッセージ履歴を取得（期限切れのメッセージは除外）
    const [messages] = await pool.execute(`
      SELECT 
        pm.id,
        pm.sender_id,
        pm.receiver_id,
        pm.message,
        pm.is_read,
        pm.read_at,
        pm.created_at,
        pm.expires_at,
        sender.name as sender_name,
        receiver.name as receiver_name
      FROM personal_messages pm
      JOIN user_accounts sender ON pm.sender_id = sender.id
      JOIN user_accounts receiver ON pm.receiver_id = receiver.id
      WHERE ((pm.sender_id = ? AND pm.receiver_id = ?) 
         OR (pm.sender_id = ? AND pm.receiver_id = ?))
         AND pm.expires_at > CONVERT_TZ(NOW(), '+00:00', '+09:00')
      ORDER BY pm.created_at ASC
    `, [user_id, other_user_id, other_user_id, user_id]);

    // データベースから取得したタイムスタンプをそのまま送信（既に日本時間で保存されている）

    // 未読メッセージを既読に更新
    await pool.execute(
      'UPDATE personal_messages SET is_read = 1, read_at = NOW() WHERE receiver_id = ? AND sender_id = ? AND is_read = 0',
      [user_id, other_user_id]
    );

    res.json({
      success: true,
      data: messages
    });

  } catch (error) {
    console.error('メッセージ履歴取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージ履歴の取得に失敗しました'
    });
  }
});

// 未読メッセージ数取得
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const [result] = await pool.execute(
      'SELECT COUNT(*) as unread_count FROM personal_messages WHERE receiver_id = ? AND is_read = 0',
      [user_id]
    );

    res.json({
      success: true,
      data: {
        unread_count: result[0].unread_count
      }
    });

  } catch (error) {
    console.error('未読メッセージ数取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '未読メッセージ数の取得に失敗しました'
    });
  }
});

// メッセージ既読更新
router.put('/read/:message_id', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const message_id = parseInt(req.params.message_id);

    if (isNaN(message_id)) {
      return res.status(400).json({
        success: false,
        message: '無効なメッセージIDです'
      });
    }

    const [result] = await pool.execute(
      'UPDATE personal_messages SET is_read = 1, read_at = NOW() WHERE id = ? AND receiver_id = ?',
      [message_id, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'メッセージが見つからないか、権限がありません'
      });
    }

    res.json({
      success: true,
      message: 'メッセージを既読にしました'
    });

  } catch (error) {
    console.error('メッセージ既読更新エラー:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージの既読更新に失敗しました'
    });
  }
});

// 指導員が担当する利用者一覧取得（メッセージ送信用）
router.get('/students', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const user_role = req.user.role;
    const { 
      instructor_filter = 'all', // 'my', 'other', 'none', 'all', 'specific'
      instructor_ids = '', // 特定の指導員IDをカンマ区切りで指定
      name_filter = '',
      tag_filter = '',
      satellite_id = null // フロントエンドから送信される拠点ID
    } = req.query;

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
    let currentSatelliteIds = currentUser.satellite_ids ? JSON.parse(currentUser.satellite_ids) : [];

    // フロントエンドから送信された拠点IDがある場合は、それを使用
    if (satellite_id) {
      console.log('Using satellite_id from frontend for message students:', satellite_id);
      currentSatelliteIds = [parseInt(satellite_id)];
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
      // JSON_OVERLAPSの代わりに、各拠点IDを個別にチェック
      const satelliteConditions = currentSatelliteIds.map(() => 
        'JSON_CONTAINS(ua.satellite_ids, ?)'
      ).join(' OR ');
      whereConditions.push(`(${satelliteConditions})`);
      queryParams.push(...currentSatelliteIds.map(id => JSON.stringify(id)));
    }

    // 担当指導員フィルタ
    switch (instructor_filter) {
      case 'my':
        whereConditions.push('ua.instructor_id = ?');
        queryParams.push(user_id);
        break;
      case 'other':
        whereConditions.push('ua.instructor_id IS NOT NULL AND ua.instructor_id != ?');
        queryParams.push(user_id);
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
            JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(CAST(s.id AS CHAR))) OR 
            JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
            JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
          )
        )`;
    }

    // 利用者一覧を取得（自分の担当利用者を優先表示）
    const query = `
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
      ORDER BY is_my_assigned DESC, ua.name ASC
    `;

    const [students] = await pool.execute(query, [user_id, ...queryParams]);

    // 各利用者の進捗率を計算
    for (let student of students) {
      try {
        // 利用者が受講しているコースの全レッスン数を取得
        const [totalLessonsResult] = await pool.execute(`
          SELECT COUNT(l.id) as total_lessons
          FROM user_courses uc
          JOIN courses c ON uc.course_id = c.id
          JOIN lessons l ON c.id = l.course_id
          WHERE uc.user_id = ? AND uc.status = 'active' AND c.status = 'active' AND l.status != 'deleted'
        `, [student.id]);

        const totalLessons = totalLessonsResult[0]?.total_lessons || 0;

        if (totalLessons > 0) {
          // 各レッスンの進捗状況を取得
          const [lessonProgress] = await pool.execute(`
            SELECT 
              l.id,
              COALESCE(ulp.status, 'not_started') as progress_status
            FROM user_courses uc
            JOIN courses c ON uc.course_id = c.id
            JOIN lessons l ON c.id = l.course_id
            LEFT JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id AND ulp.user_id = uc.user_id
            WHERE uc.user_id = ? AND uc.status = 'active' AND c.status = 'active' AND l.status != 'deleted'
            ORDER BY l.order_index ASC
          `, [student.id]);

          // 進捗率を計算（受講完了:1, 受講中:0.5, 未受講:0）
          const completedLessons = lessonProgress.filter(l => l.progress_status === 'completed').length;
          const inProgressLessons = lessonProgress.filter(l => l.progress_status === 'in_progress').length;
          const weightedProgress = completedLessons + (inProgressLessons * 0.5);
          const progressPercentage = Math.round((weightedProgress / totalLessons) * 10000) / 100; // 小数点第2位まで

          student.progress = progressPercentage;
        } else {
          student.progress = 0;
        }
      } catch (error) {
        console.error(`利用者ID ${student.id} の進捗率計算エラー:`, error);
        student.progress = 0;
      }
    }

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    console.error('担当利用者一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '担当利用者一覧の取得に失敗しました'
    });
  }
});

// 最小限テスト用エンドポイント（デバッグ用）
router.get('/instructors-test', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    console.log('=== 最小限テスト開始 ===');
    console.log('user_id:', user_id);
    
    // 最もシンプルなユーザー情報取得
    const [userRows] = await pool.execute(
      'SELECT id, name, instructor_id, satellite_ids, company_id FROM user_accounts WHERE id = ? AND status = 1',
      [user_id]
    );
    
    console.log('クエリ結果:', userRows);
    
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ユーザー情報が見つかりません'
      });
    }
    
    const user = userRows[0];
    console.log('ユーザー情報取得成功:', user);
    
    res.json({
      success: true,
      message: '最小限テスト成功',
      user_data: user
    });
    
  } catch (error) {
    console.error('最小限テストエラー:', error);
    console.error('エラー詳細:', {
      message: error.message,
      stack: error.stack,
      sql: error.sql,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({
      success: false,
      message: '最小限テストエラー',
      error: error.message,
      sql: error.sql
    });
  }
});

// データベース接続テスト用エンドポイント
router.get('/db-test', authenticateToken, async (req, res) => {
  try {
    console.log('=== データベース接続テスト開始 ===');
    
    // 最もシンプルなクエリ
    const [result] = await pool.execute('SELECT 1 as test');
    console.log('データベース接続テスト結果:', result);
    
    res.json({
      success: true,
      message: 'データベース接続テスト成功',
      result: result
    });
    
  } catch (error) {
    console.error('データベース接続テストエラー:', error);
    res.status(500).json({
      success: false,
      message: 'データベース接続テスト失敗',
      error: error.message
    });
  }
});

// JSON関数テスト用エンドポイント
router.get('/json-test', authenticateToken, async (req, res) => {
  try {
    console.log('=== JSON関数テスト開始 ===');
    
    // MySQLバージョン確認
    const [version] = await pool.execute('SELECT VERSION() as version');
    console.log('MySQLバージョン:', version[0].version);
    
    // JSON関数の動作確認
    const [jsonTest] = await pool.execute(`
      SELECT 
        JSON_CONTAINS('[1,2,3]', '1') as json_contains_test,
        JSON_QUOTE('test') as json_quote_test,
        JSON_SEARCH('[1,2,3]', 'one', '1') as json_search_test
    `);
    console.log('JSON関数テスト結果:', jsonTest[0]);
    
    res.json({
      success: true,
      message: 'JSON関数テスト成功',
      mysql_version: version[0].version,
      json_test_results: jsonTest[0]
    });
    
  } catch (error) {
    console.error('JSON関数テストエラー:', error);
    res.status(500).json({
      success: false,
      message: 'JSON関数テスト失敗',
      error: error.message,
      sql: error.sql
    });
  }
});

// ユーザーデータ構造テスト用エンドポイント
router.get('/user-data-test', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    console.log('=== ユーザーデータ構造テスト開始 ===');
    console.log('user_id:', user_id);
    
    // ユーザー情報を取得（satellite_idsの内容を詳しく確認）
    const [userRows] = await pool.execute(`
      SELECT 
        id, 
        name, 
        instructor_id, 
        satellite_ids,
        company_id,
        TYPEOF(satellite_ids) as satellite_ids_type,
        JSON_TYPE(satellite_ids) as satellite_ids_json_type,
        JSON_VALID(satellite_ids) as satellite_ids_valid
      FROM user_accounts 
      WHERE id = ? AND status = 1
    `, [user_id]);
    
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ユーザー情報が見つかりません'
      });
    }
    
    const user = userRows[0];
    console.log('ユーザーデータ構造:', user);
    
    // satellite_idsが有効なJSONの場合、パースを試行
    let parsedSatelliteIds = null;
    if (user.satellite_ids) {
      try {
        parsedSatelliteIds = JSON.parse(user.satellite_ids);
        console.log('パースされたsatellite_ids:', parsedSatelliteIds);
      } catch (parseError) {
        console.error('satellite_idsのパースエラー:', parseError);
      }
    }
    
    res.json({
      success: true,
      message: 'ユーザーデータ構造テスト成功',
      user_data: user,
      parsed_satellite_ids: parsedSatelliteIds
    });
    
  } catch (error) {
    console.error('ユーザーデータ構造テストエラー:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザーデータ構造テスト失敗',
      error: error.message,
      sql: error.sql
    });
  }
});

// 利用者が所属拠点の指導員一覧取得（メッセージ送信用）
router.get('/instructors', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const user_role = req.user.role;

    console.log('=== 指導員一覧取得開始 ===');
    console.log('user_id:', user_id, 'user_role:', user_role);

    // 利用者（ロール1-3）のみアクセス可能
    if (user_role < 1 || user_role > 3) {
      console.log('アクセス拒否: ロールが不正', user_role);
      return res.status(403).json({
        success: false,
        message: '利用者のみアクセス可能です'
      });
    }

    // 利用者の情報を取得
    console.log('Debug: user_id =', user_id, 'type:', typeof user_id);
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'ユーザーIDが取得できません'
      });
    }
    
    const [userRows] = await pool.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.instructor_id,
        ua.satellite_ids,
        ua.company_id,
        s.name as satellite_name,
        c.name as company_name
      FROM user_accounts ua
      LEFT JOIN satellites s ON (
        s.id IS NOT NULL AND ua.satellite_ids IS NOT NULL AND (
          JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(CAST(s.id AS CHAR))) OR 
          JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
          JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
        )
      )
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.id = ? AND ua.status = 1
    `, [user_id]);

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ユーザー情報が見つかりません'
      });
    }

    const user = userRows[0];

    let satelliteIds = [];
    if (user.satellite_ids) {
      try {
        if (Array.isArray(user.satellite_ids)) {
          satelliteIds = user.satellite_ids;
        } else if (typeof user.satellite_ids === 'string') {
          satelliteIds = JSON.parse(user.satellite_ids);
        } else {
          satelliteIds = [user.satellite_ids];
        }
      } catch (error) {
        console.error('satellite_idsパースエラー:', error);
        satelliteIds = [];
      }
    }

    if ((!satelliteIds || satelliteIds.length === 0) && user.satellite_id) {
      satelliteIds = [user.satellite_id];
    }

    satelliteIds = Array.isArray(satelliteIds) ? satelliteIds : [satelliteIds];
    satelliteIds = satelliteIds
      .map(id => {
        const numericId = Number(id);
        return Number.isNaN(numericId) ? null : numericId;
      })
      .filter((id, index, self) => id !== null && self.indexOf(id) === index);

    console.log('Debug: user data =', {
      instructor_id: user.instructor_id,
      company_id: user.company_id,
      satellite_ids: satelliteIds
    });

    // パラメータの検証
    const instructorId = user.instructor_id || null;
    const companyId = user.company_id || null;

    // 所属拠点の指導員一覧を取得（担当指導員を最上位に表示）
    let whereConditions = ['ua.role = 4', 'ua.status = 1'];
    let queryParams = [];

    // 企業条件
    if (companyId) {
      whereConditions.push('ua.company_id = ?');
      queryParams.push(companyId);
    }

    // 拠点IDの条件（複数拠点対応）
    if (satelliteIds.length > 0) {
      const satelliteConditions = satelliteIds
        .map(() => '(JSON_CONTAINS(ua.satellite_ids, CAST(? AS JSON)) OR JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(CAST(? AS CHAR))))')
        .join(' OR ');
      whereConditions.push(`(${satelliteConditions})`);
      satelliteIds.forEach(id => {
        queryParams.push(JSON.stringify(id));
        queryParams.push(String(id));
      });
    } else if (instructorId) {
      // 拠点情報が取得できない場合は担当指導員のみに限定
      console.warn('利用者のsatellite_idsが空のため、担当指導員のみを返します。', {
        user_id,
        instructor_id: instructorId
      });
      whereConditions.push('ua.id = ?');
      queryParams.push(instructorId);
    } else {
      console.warn('利用者のsatellite_idsと担当指導員情報が取得できませんでした。', {
        user_id
      });
      return res.json({
        success: true,
        data: {
          instructors: [],
          assigned_instructor_id: null,
          debug_info: {
            user_id: user_id,
            user_company_id: user.company_id,
            user_satellite_ids: satelliteIds,
            user_instructor_id: user.instructor_id,
            query_conditions: whereConditions,
            query_params: queryParams
          }
        }
      });
    }

    console.log('Debug: whereConditions =', whereConditions);
    console.log('Debug: queryParams =', queryParams);
    console.log('データベースクエリ実行前');

    const [instructors] = await pool.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.email,
        ua.role,
        CASE WHEN ua.id = ? THEN 1 ELSE 0 END as is_assigned,
        s.name as satellite_name,
        c.name as company_name
      FROM user_accounts ua
      LEFT JOIN satellites s ON (
        s.id IS NOT NULL AND ua.satellite_ids IS NOT NULL AND (
          JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(CAST(s.id AS CHAR))) OR 
          JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
          JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
        )
      )
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY is_assigned DESC, ua.name ASC
    `, [user.instructor_id || 0, ...queryParams]);

    console.log('データベースクエリ実行完了');
    console.log('取得した指導員数:', instructors.length);
    console.log('取得した指導員一覧:', instructors.map(i => ({ id: i.id, name: i.name, company_id: i.company_id, satellite_ids: i.satellite_name })));

    res.json({
      success: true,
      data: {
        instructors,
        assigned_instructor_id: user.instructor_id,
        debug_info: {
          user_id: user_id,
          user_company_id: user.company_id,
          user_satellite_ids: satelliteIds,
          user_instructor_id: user.instructor_id,
          query_conditions: whereConditions,
          query_params: queryParams
        }
      }
    });

  } catch (error) {
    console.error('指導員一覧取得エラー:', error);
    console.error('エラー詳細:', {
      message: error.message,
      stack: error.stack,
      sql: error.sql,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({
      success: false,
      message: '指導員一覧の取得に失敗しました',
      error: error.message
    });
  }
});

// 拠点の指導員一覧取得（フィルター用）
router.get('/instructors-for-filter', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const user_role = req.user.role;
    const { satellite_id = null } = req.query; // フロントエンドから送信される拠点ID

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
    let currentSatelliteIds = currentUser.satellite_ids ? JSON.parse(currentUser.satellite_ids) : [];

    // フロントエンドから送信された拠点IDがある場合は、それを使用
    if (satellite_id) {
      console.log('Using satellite_id from frontend for message instructors:', satellite_id);
      currentSatelliteIds = [parseInt(satellite_id)];
    }

    // 1対1メッセージは管理者・指導員⇔利用者間のやり取り
    // 管理者・指導員（ロール4以上）は利用者（ロール1）のみを対象とする
    let whereConditions = ['ua.role = 1', 'ua.status = 1'];
    let queryParams = [];

    if (currentCompanyId) {
      whereConditions.push('ua.company_id = ?');
      queryParams.push(currentCompanyId);
    }

    if (currentSatelliteIds.length > 0) {
      // JSON_OVERLAPSの代わりに、各拠点IDを個別にチェック
      const satelliteConditions = currentSatelliteIds.map(() => 
        'JSON_CONTAINS(ua.satellite_ids, ?)'
      ).join(' OR ');
      whereConditions.push(`(${satelliteConditions})`);
      queryParams.push(...currentSatelliteIds.map(id => JSON.stringify(id)));
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
            JSON_CONTAINS(ua.satellite_ids, JSON_QUOTE(CAST(s.id AS CHAR))) OR 
            JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON)) OR
            JSON_SEARCH(ua.satellite_ids, 'one', CAST(s.id AS CHAR)) IS NOT NULL
          )
        )`;
    }

    const [instructors] = await pool.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.role,
        '利用者' as role_name,
        ${satelliteSelect},
        c.name as company_name
      FROM user_accounts ua
      ${satelliteJoin}
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ua.name ASC
    `, queryParams);

    res.json({
      success: true,
      data: instructors
    });

  } catch (error) {
    console.error('指導員一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '指導員一覧の取得に失敗しました'
    });
  }
});

module.exports = router;
