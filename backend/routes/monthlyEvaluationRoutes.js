const express = require('express');
const router = express.Router();
const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');

/**
 * 月次評価記録のCRUD操作
 */

// 月次評価記録一覧取得（特定ユーザー）
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { periodStart, periodEnd } = req.query;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    let query = `
      SELECT 
        mer.*,
        ua.name as user_name,
        ua.recipient_number
      FROM monthly_evaluation_records mer
      LEFT JOIN user_accounts ua ON mer.user_id = ua.id
      WHERE mer.user_id = ?
    `;
    
    const params = [userId];
    
    if (periodStart && periodEnd) {
      query += ` AND mer.date >= ? AND mer.date <= ?`;
      params.push(periodStart, periodEnd);
    }
    
    query += ` ORDER BY mer.date DESC`;
    
    const [rows] = await connection.execute(query, params);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('月次評価記録一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '月次評価記録の取得中にエラーが発生しました',
      error: error.message
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
});

// 特定の月次評価記録取得
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        mer.*,
        ua.name as user_name,
        ua.recipient_number
      FROM monthly_evaluation_records mer
      LEFT JOIN user_accounts ua ON mer.user_id = ua.id
      WHERE mer.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '月次評価記録が見つかりません'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    customLogger.error('月次評価記録取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '月次評価記録の取得中にエラーが発生しました',
      error: error.message
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
});

// 前回の月次評価記録取得（前回の達成度評価日用）
router.get('/user/:userId/latest', async (req, res) => {
  const { userId } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        id,
        date,
        created_at
      FROM monthly_evaluation_records
      WHERE user_id = ?
      ORDER BY date DESC
      LIMIT 1
    `, [userId]);
    
    res.json({
      success: true,
      data: rows.length > 0 ? rows[0] : null
    });
  } catch (error) {
    customLogger.error('前回月次評価記録取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '前回月次評価記録の取得中にエラーが発生しました',
      error: error.message
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
});

// 月次評価記録作成
router.post('/', async (req, res) => {
  const {
    user_id,
    date,
    mark_start,
    mark_end,
    evaluation_method,
    method_other,
    goal,
    effort,
    achievement,
    issues,
    improvement,
    health,
    others,
    appropriateness,
    evaluator_name,
    prev_evaluation_date,
    recipient_number,
    user_name
  } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(`
      INSERT INTO monthly_evaluation_records (
        user_id, date, mark_start, mark_end, evaluation_method, method_other,
        goal, effort, achievement, issues, improvement, health, others,
        appropriateness, evaluator_name, prev_evaluation_date,
        recipient_number, user_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user_id, date, mark_start, mark_end, evaluation_method, method_other,
      goal, effort, achievement, issues, improvement, health, others,
      appropriateness, evaluator_name, prev_evaluation_date,
      recipient_number, user_name
    ]);
    
    res.status(201).json({
      success: true,
      message: '月次評価記録が正常に作成されました',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    customLogger.error('月次評価記録作成エラー:', error);
    res.status(500).json({
      success: false,
      message: '月次評価記録の作成中にエラーが発生しました',
      error: error.message
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
});

// 月次評価記録更新
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    date,
    mark_start,
    mark_end,
    evaluation_method,
    method_other,
    goal,
    effort,
    achievement,
    issues,
    improvement,
    health,
    others,
    appropriateness,
    evaluator_name,
    prev_evaluation_date,
    recipient_number,
    user_name
  } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(`
      UPDATE monthly_evaluation_records SET
        date = ?, mark_start = ?, mark_end = ?, evaluation_method = ?, method_other = ?,
        goal = ?, effort = ?, achievement = ?, issues = ?, improvement = ?, health = ?,
        others = ?, appropriateness = ?, evaluator_name = ?, prev_evaluation_date = ?,
        recipient_number = ?, user_name = ?
      WHERE id = ?
    `, [
      date, mark_start, mark_end, evaluation_method, method_other,
      goal, effort, achievement, issues, improvement, health,
      others, appropriateness, evaluator_name, prev_evaluation_date,
      recipient_number, user_name, id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '月次評価記録が見つかりません'
      });
    }
    
    res.json({
      success: true,
      message: '月次評価記録が正常に更新されました'
    });
  } catch (error) {
    customLogger.error('月次評価記録更新エラー:', error);
    res.status(500).json({
      success: false,
      message: '月次評価記録の更新中にエラーが発生しました',
      error: error.message
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
});

// 月次評価記録削除
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(`
      DELETE FROM monthly_evaluation_records WHERE id = ?
    `, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '月次評価記録が見つかりません'
      });
    }
    
    res.json({
      success: true,
      message: '月次評価記録が正常に削除されました'
    });
  } catch (error) {
    customLogger.error('月次評価記録削除エラー:', error);
    res.status(500).json({
      success: false,
      message: '月次評価記録の削除中にエラーが発生しました',
      error: error.message
    });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('接続の解放に失敗:', releaseError);
      }
    }
  }
});

module.exports = router;
