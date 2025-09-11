const express = require('express');
const router = express.Router();
const { pool } = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');

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
    
    // メッセージ送信
    const [result] = await pool.execute(
      'INSERT INTO personal_messages (sender_id, receiver_id, message, expires_at) VALUES (?, ?, ?, ?)',
      [sender_id, receiver_id, message.trim(), tomorrow]
    );

    // 送信者と受信者の情報を取得
    const [senderRows] = await pool.execute(
      'SELECT id, name, role FROM user_accounts WHERE id = ?',
      [sender_id]
    );

    res.status(201).json({
      success: true,
      message: 'メッセージを送信しました',
      data: {
        id: result.insertId,
        sender: senderRows[0],
        receiver: receiverRows[0],
        message: message.trim(),
        created_at: new Date()
      }
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

    // ユーザーとの会話相手一覧を取得
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
      WHERE pm.sender_id = ? OR pm.receiver_id = ?
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

    // メッセージ履歴を取得
    const [messages] = await pool.execute(`
      SELECT 
        pm.id,
        pm.sender_id,
        pm.receiver_id,
        pm.message,
        pm.is_read,
        pm.read_at,
        pm.created_at,
        sender.name as sender_name,
        receiver.name as receiver_name
      FROM personal_messages pm
      JOIN user_accounts sender ON pm.sender_id = sender.id
      JOIN user_accounts receiver ON pm.receiver_id = receiver.id
      WHERE (pm.sender_id = ? AND pm.receiver_id = ?) 
         OR (pm.sender_id = ? AND pm.receiver_id = ?)
      ORDER BY pm.created_at ASC
    `, [user_id, other_user_id, other_user_id, user_id]);

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

    // 指導員（ロール4）のみアクセス可能
    if (user_role !== 4) {
      return res.status(403).json({
        success: false,
        message: '指導員のみアクセス可能です'
      });
    }

    // 担当する利用者一覧を取得
    const [students] = await pool.execute(`
      SELECT 
        ua.id,
        ua.name,
        ua.email,
        ua.login_code,
        s.name as satellite_name,
        c.name as company_name
      FROM user_accounts ua
      LEFT JOIN satellites s ON JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.instructor_id = ? AND ua.role = 1 AND ua.status = 1
      ORDER BY ua.name
    `, [user_id]);

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

// 利用者が所属拠点の指導員一覧取得（メッセージ送信用）
router.get('/instructors', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const user_role = req.user.role;

    // 利用者（ロール1-3）のみアクセス可能
    if (user_role < 1 || user_role > 3) {
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
      LEFT JOIN satellites s ON JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
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
    const satelliteIds = user.satellite_ids ? JSON.parse(user.satellite_ids) : [];

    console.log('Debug: user data =', {
      instructor_id: user.instructor_id,
      company_id: user.company_id,
      satellite_ids: satelliteIds
    });

    // パラメータの検証
    const instructorId = user.instructor_id || null;
    const companyId = user.company_id || null;
    const satelliteIdsJson = JSON.stringify(satelliteIds);

    // 所属拠点の指導員一覧を取得（担当指導員を最上位に表示）
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
      LEFT JOIN satellites s ON JSON_CONTAINS(ua.satellite_ids, CAST(s.id AS JSON))
      LEFT JOIN companies c ON ua.company_id = c.id
      WHERE ua.role = 4 
        AND ua.status = 1
        AND (
          ua.id = ? OR 
          ua.company_id = ? OR
          JSON_OVERLAPS(ua.satellite_ids, ?)
        )
      ORDER BY is_assigned DESC, ua.name ASC
    `, [instructorId, instructorId, companyId, satelliteIdsJson]);

    res.json({
      success: true,
      data: {
        instructors,
        assigned_instructor_id: user.instructor_id
      }
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
