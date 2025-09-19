const express = require('express');
const router = express.Router();
const { pool } = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * リアルタイムusername重複チェックAPI
 * GET /api/username/check/:username
 */
router.get('/check/:username', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user.user_id; // 更新時は現在のユーザーIDを除外
    
    // バリデーション
    if (!username || username.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'ログインIDを指定してください'
      });
    }
    
    // 文字種チェック
    if (!/^[a-zA-Z0-9_/.-]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'ログインIDは半角英数字、アンダースコア、ハイフン、スラッシュ、ドットのみ使用可能です',
        available: false
      });
    }
    
    // 長さチェック
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'ログインIDは3文字以上50文字以下で入力してください',
        available: false
      });
    }
    
    // データベースで重複チェック
    let query, params;
    if (currentUserId) {
      // 更新時：現在のユーザーIDを除外してチェック
      query = `
        SELECT COUNT(*) as count 
        FROM admin_credentials 
        WHERE username = ? AND user_id != ?
      `;
      params = [username, currentUserId];
    } else {
      // 新規作成時：全てのusernameをチェック
      query = `
        SELECT COUNT(*) as count 
        FROM admin_credentials 
        WHERE username = ?
      `;
      params = [username];
    }
    
    const [rows] = await pool.execute(query, params);
    const count = rows[0].count;
    
    if (count > 0) {
      return res.json({
        success: true,
        available: false,
        message: 'このログインIDは既に使用されています'
      });
    } else {
      return res.json({
        success: true,
        available: true,
        message: 'このログインIDは使用可能です'
      });
    }
    
  } catch (error) {
    console.error('username重複チェックエラー:', error);
    res.status(500).json({
      success: false,
      message: 'ログインIDの重複チェックに失敗しました',
      error: error.message
    });
  }
});

/**
 * 複数usernameの一括重複チェックAPI
 * POST /api/username/check-bulk
 */
router.post('/check-bulk', authenticateToken, async (req, res) => {
  try {
    const { usernames } = req.body;
    const currentUserId = req.user.user_id;
    
    // バリデーション
    if (!Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ログインIDの配列を指定してください'
      });
    }
    
    if (usernames.length > 100) {
      return res.status(400).json({
        success: false,
        message: '一度にチェックできるログインIDは100個までです'
      });
    }
    
    const results = [];
    
    for (const username of usernames) {
      // 文字種チェック
      if (!/^[a-zA-Z0-9_/.-]+$/.test(username)) {
        results.push({
          username,
          available: false,
          message: 'ログインIDは半角英数字、アンダースコア、ハイフン、スラッシュ、ドットのみ使用可能です'
        });
        continue;
      }
      
      // 長さチェック
      if (username.length < 3 || username.length > 50) {
        results.push({
          username,
          available: false,
          message: 'ログインIDは3文字以上50文字以下で入力してください'
        });
        continue;
      }
      
      // データベースで重複チェック
      let query, params;
      if (currentUserId) {
        query = `
          SELECT COUNT(*) as count 
          FROM admin_credentials 
          WHERE username = ? AND user_id != ?
        `;
        params = [username, currentUserId];
      } else {
        query = `
          SELECT COUNT(*) as count 
          FROM admin_credentials 
          WHERE username = ?
        `;
        params = [username];
      }
      
      const [rows] = await pool.execute(query, params);
      const count = rows[0].count;
      
      results.push({
        username,
        available: count === 0,
        message: count > 0 ? 'このログインIDは既に使用されています' : 'このログインIDは使用可能です'
      });
    }
    
    return res.json({
      success: true,
      results
    });
    
  } catch (error) {
    console.error('username一括重複チェックエラー:', error);
    res.status(500).json({
      success: false,
      message: 'ログインIDの一括重複チェックに失敗しました',
      error: error.message
    });
  }
});

/**
 * 利用可能なusername候補を提案するAPI
 * GET /api/username/suggestions/:baseUsername
 */
router.get('/suggestions/:baseUsername', authenticateToken, async (req, res) => {
  try {
    const { baseUsername } = req.params;
    const currentUserId = req.user.user_id;
    
    // バリデーション
    if (!baseUsername || baseUsername.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'ベースとなるログインIDを指定してください'
      });
    }
    
    // 文字種チェック
    if (!/^[a-zA-Z0-9_/.-]+$/.test(baseUsername)) {
      return res.status(400).json({
        success: false,
        message: 'ログインIDは半角英数字、アンダースコア、ハイフン、スラッシュ、ドットのみ使用可能です'
      });
    }
    
    const suggestions = [];
    const maxSuggestions = 10;
    
    // 数字を追加した候補を生成
    for (let i = 1; i <= maxSuggestions; i++) {
      const candidate = `${baseUsername}${i}`;
      
      // 長さチェック
      if (candidate.length > 50) continue;
      
      // データベースで重複チェック
      let query, params;
      if (currentUserId) {
        query = `
          SELECT COUNT(*) as count 
          FROM admin_credentials 
          WHERE username = ? AND user_id != ?
        `;
        params = [candidate, currentUserId];
      } else {
        query = `
          SELECT COUNT(*) as count 
          FROM admin_credentials 
          WHERE username = ?
        `;
        params = [candidate];
      }
      
      const [rows] = await pool.execute(query, params);
      const count = rows[0].count;
      
      if (count === 0) {
        suggestions.push(candidate);
        if (suggestions.length >= 5) break; // 5個の候補で十分
      }
    }
    
    return res.json({
      success: true,
      suggestions,
      message: suggestions.length > 0 ? 
        `${suggestions.length}個の利用可能な候補が見つかりました` : 
        '利用可能な候補が見つかりませんでした'
    });
    
  } catch (error) {
    console.error('username候補提案エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ログインID候補の提案に失敗しました',
      error: error.message
    });
  }
});

module.exports = router;
