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

// 拠点内の在宅支援利用者の個別支援計画の目標達成予定日を取得
const getSatelliteSupportPlanGoalDates = async (req, res) => {
  try {
    const { satelliteId } = req.params;
    
    const sql = `
      SELECT 
        sp.user_id,
        ua.name as user_name,
        sp.goal_date,
        sp.updated_at
      FROM support_plans sp
      INNER JOIN user_accounts ua ON sp.user_id = ua.id
      WHERE ua.satellite_ids LIKE ? 
        AND ua.is_remote_user = 1
        AND sp.goal_date IS NOT NULL
      ORDER BY sp.goal_date ASC
    `;
    
    const satelliteIdPattern = `%"${satelliteId}"%`;
    const result = await query(sql, [satelliteIdPattern]);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    customLogger.error('拠点個別支援計画目標日取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '個別支援計画の目標達成予定日の取得中にエラーが発生しました',
      error: error.message
    });
  }
};

// 拠点内の在宅支援利用者の個別支援計画状況を取得（記録がない利用者も含む）
const getSatelliteSupportPlanStatus = async (req, res) => {
  try {
    const { satelliteId } = req.params;
    
    console.log('個別支援計画状況取得開始 - satelliteId:', satelliteId);
    
    const sql = `
      SELECT 
        ua.id as user_id,
        ua.name as user_name,
        sp.goal_date,
        sp.updated_at,
        CASE 
          WHEN sp.id IS NULL THEN 'no_record'
          WHEN sp.goal_date IS NULL THEN 'no_goal_date'
          ELSE 'has_goal_date'
        END as status
      FROM user_accounts ua
      LEFT JOIN support_plans sp ON ua.id = sp.user_id
      WHERE JSON_CONTAINS(ua.satellite_ids, ?)
        AND ua.is_remote_user = 1
        AND ua.status = 1
      ORDER BY ua.name ASC
    `;
    
    const satelliteIdJson = JSON.stringify(parseInt(satelliteId));
    console.log('SQL実行:', sql, 'パラメータ:', [satelliteIdJson]);
    
    const result = await query(sql, [satelliteIdJson]);
    
    console.log('SQL実行結果:', result);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('拠点個別支援計画状況取得エラー詳細:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      stack: error.stack
    });
    customLogger.error('拠点個別支援計画状況取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '個別支援計画の状況取得中にエラーが発生しました',
      error: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage
    });
  }
};

module.exports = {
  getSupportPlans,
  getSupportPlanByUserId,
  createSupportPlan,
  updateSupportPlan,
  deleteSupportPlan,
  upsertSupportPlan,
  getSatelliteSupportPlanGoalDates,
  getSatelliteSupportPlanStatus
};