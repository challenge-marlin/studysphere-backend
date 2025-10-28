const express = require('express');
const router = express.Router();
const { pool } = require('../utils/database');
const { customLogger } = require('../utils/logger');

/**
 * 週次評価記録のCRUD操作
 */

// 前回評価日取得（より具体的なパスを先に配置）
router.get('/user/:userId/last-evaluation-date', async (req, res) => {
  const { userId } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        MAX(created_at) as last_evaluation_date
      FROM weekly_evaluation_records
      WHERE user_id = ?
    `, [userId]);
    
    const lastEvaluationDate = rows[0]?.last_evaluation_date ? 
      new Date(rows[0].last_evaluation_date).toISOString().split('T')[0] : null;
    
    res.json({
      success: true,
      data: {
        last_evaluation_date: lastEvaluationDate
      }
    });
  } catch (error) {
    customLogger.error('前回評価日取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '前回評価日の取得中にエラーが発生しました',
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

// 週次評価記録一覧取得（特定ユーザー）
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { periodStart, periodEnd } = req.query;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    let query = `
      SELECT 
        wer.*,
        ua.name as user_name
      FROM weekly_evaluation_records wer
      LEFT JOIN user_accounts ua ON wer.user_id = ua.id
      WHERE wer.user_id = ?
    `;
    
    const params = [userId];
    
    if (periodStart && periodEnd) {
      query += ` AND wer.period_start >= ? AND wer.period_end <= ?`;
      params.push(periodStart, periodEnd);
    }
    
    query += ` ORDER BY wer.created_at DESC`;
    
    const [rows] = await connection.execute(query, params);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    customLogger.error('週次評価記録一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '週次評価記録の取得中にエラーが発生しました',
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

// 特定の週次評価記録取得
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.execute(`
      SELECT 
        wer.*,
        ua.name as user_name
      FROM weekly_evaluation_records wer
      LEFT JOIN user_accounts ua ON wer.user_id = ua.id
      WHERE wer.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '週次評価記録が見つかりません'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    customLogger.error('週次評価記録取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '週次評価記録の取得中にエラーが発生しました',
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

// 週次評価記録作成
router.post('/', async (req, res) => {
  const {
    user_id,
    date,
    prev_eval_date,
    period_start,
    period_end,
    evaluation_method,
    method_other,
    evaluation_content,
    recorder_name,
    confirm_name
  } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(`
      INSERT INTO weekly_evaluation_records (
        user_id, date, prev_eval_date, period_start, period_end,
        evaluation_method, method_other, evaluation_content,
        recorder_name, confirm_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user_id, date, prev_eval_date, period_start, period_end,
      evaluation_method, method_other, evaluation_content,
      recorder_name, confirm_name
    ]);
    
    res.status(201).json({
      success: true,
      message: '週次評価記録が正常に作成されました',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    customLogger.error('週次評価記録作成エラー:', error);
    res.status(500).json({
      success: false,
      message: '週次評価記録の作成中にエラーが発生しました',
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

// 週次評価記録更新
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    date,
    prev_eval_date,
    period_start,
    period_end,
    evaluation_method,
    method_other,
    evaluation_content,
    recorder_name,
    confirm_name
  } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(`
      UPDATE weekly_evaluation_records SET
        date = ?, prev_eval_date = ?, period_start = ?, period_end = ?,
        evaluation_method = ?, method_other = ?, evaluation_content = ?,
        recorder_name = ?, confirm_name = ?
      WHERE id = ?
    `, [
      date, prev_eval_date, period_start, period_end,
      evaluation_method, method_other, evaluation_content,
      recorder_name, confirm_name, id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '週次評価記録が見つかりません'
      });
    }
    
    res.json({
      success: true,
      message: '週次評価記録が正常に更新されました'
    });
  } catch (error) {
    customLogger.error('週次評価記録更新エラー:', error);
    res.status(500).json({
      success: false,
      message: '週次評価記録の更新中にエラーが発生しました',
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

// 週次評価記録削除
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.execute(`
      DELETE FROM weekly_evaluation_records WHERE id = ?
    `, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '週次評価記録が見つかりません'
      });
    }
    
    res.json({
      success: true,
      message: '週次評価記録が正常に削除されました'
    });
  } catch (error) {
    customLogger.error('週次評価記録削除エラー:', error);
    res.status(500).json({
      success: false,
      message: '週次評価記録の削除中にエラーが発生しました',
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
