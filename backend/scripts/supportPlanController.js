const { query } = require('../utils/database');
const { customLogger } = require('../utils/logger');

// 個別支援計画一覧取得
const getSupportPlans = async (req, res) => {
  try {
    const sql = `
      SELECT sp.*, ua.name as user_name, ua.email as user_email
      FROM support_plans sp
      LEFT JOIN user_accounts ua ON sp.user_id = ua.id
      ORDER BY sp.updated_at DESC
    `;
    
    const result = await query(sql);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    customLogger.error('個別支援計画一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '個別支援計画の取得中にエラーが発生しました',
      error: error.message
    });
  }
};

// 特定ユーザーの個別支援計画取得
const getSupportPlanByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const sql = `
      SELECT sp.*, ua.name as user_name, ua.email as user_email
      FROM support_plans sp
      LEFT JOIN user_accounts ua ON sp.user_id = ua.id
      WHERE sp.user_id = ?
    `;
    
    const result = await query(sql, [userId]);
    
    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: '個別支援計画が見つかりません'
      });
    }
    
    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    customLogger.error('個別支援計画取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '個別支援計画の取得中にエラーが発生しました',
      error: error.message
    });
  }
};

// 個別支援計画作成
const createSupportPlan = async (req, res) => {
  try {
    const { user_id, long_term_goal, short_term_goal, needs, support_content, goal_date } = req.body;
    
    // 既存の個別支援計画があるかチェック
    const checkSql = 'SELECT id FROM support_plans WHERE user_id = ?';
    const existing = await query(checkSql, [user_id]);
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'このユーザーには既に個別支援計画が存在します'
      });
    }
    
    const sql = `
      INSERT INTO support_plans (user_id, long_term_goal, short_term_goal, needs, support_content, goal_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await query(sql, [user_id, long_term_goal, short_term_goal, needs, support_content, goal_date]);
    
    res.status(201).json({
      success: true,
      message: '個別支援計画が正常に作成されました',
      data: {
        id: result.insertId,
        user_id,
        long_term_goal,
        short_term_goal,
        needs,
        support_content,
        goal_date
      }
    });
  } catch (error) {
    customLogger.error('個別支援計画作成エラー:', error);
    res.status(500).json({
      success: false,
      message: '個別支援計画の作成中にエラーが発生しました',
      error: error.message
    });
  }
};

// 個別支援計画更新
const updateSupportPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { long_term_goal, short_term_goal, needs, support_content, goal_date } = req.body;
    
    const sql = `
      UPDATE support_plans 
      SET long_term_goal = ?, short_term_goal = ?, needs = ?, support_content = ?, goal_date = ?
      WHERE id = ?
    `;
    
    const result = await query(sql, [long_term_goal, short_term_goal, needs, support_content, goal_date, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '個別支援計画が見つかりません'
      });
    }
    
    res.json({
      success: true,
      message: '個別支援計画が正常に更新されました'
    });
  } catch (error) {
    customLogger.error('個別支援計画更新エラー:', error);
    res.status(500).json({
      success: false,
      message: '個別支援計画の更新中にエラーが発生しました',
      error: error.message
    });
  }
};

// 個別支援計画削除
const deleteSupportPlan = async (req, res) => {
  try {
    const { id } = req.params;
    
    const sql = 'DELETE FROM support_plans WHERE id = ?';
    const result = await query(sql, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '個別支援計画が見つかりません'
      });
    }
    
    res.json({
      success: true,
      message: '個別支援計画が正常に削除されました'
    });
  } catch (error) {
    customLogger.error('個別支援計画削除エラー:', error);
    res.status(500).json({
      success: false,
      message: '個別支援計画の削除中にエラーが発生しました',
      error: error.message
    });
  }
};

// 個別支援計画作成または更新（upsert）
const upsertSupportPlan = async (req, res) => {
  try {
    const { user_id, long_term_goal, short_term_goal, needs, support_content, goal_date } = req.body;
    
    // 既存の個別支援計画があるかチェック
    const checkSql = 'SELECT id FROM support_plans WHERE user_id = ?';
    const existing = await query(checkSql, [user_id]);
    
    if (existing.length > 0) {
      // 更新
      const updateSql = `
        UPDATE support_plans 
        SET long_term_goal = ?, short_term_goal = ?, needs = ?, support_content = ?, goal_date = ?
        WHERE user_id = ?
      `;
      
      await query(updateSql, [long_term_goal, short_term_goal, needs, support_content, goal_date, user_id]);
      
      res.json({
        success: true,
        message: '個別支援計画が正常に更新されました',
        data: { id: existing[0].id }
      });
    } else {
      // 作成
      const insertSql = `
        INSERT INTO support_plans (user_id, long_term_goal, short_term_goal, needs, support_content, goal_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const result = await query(insertSql, [user_id, long_term_goal, short_term_goal, needs, support_content, goal_date]);
      
      res.status(201).json({
        success: true,
        message: '個別支援計画が正常に作成されました',
        data: { id: result.insertId }
      });
    }
  } catch (error) {
    customLogger.error('個別支援計画upsertエラー:', error);
    res.status(500).json({
      success: false,
      message: '個別支援計画の保存中にエラーが発生しました',
      error: error.message
    });
  }
};

module.exports = {
  getSupportPlans,
  getSupportPlanByUserId,
  createSupportPlan,
  updateSupportPlan,
  deleteSupportPlan,
  upsertSupportPlan
};
