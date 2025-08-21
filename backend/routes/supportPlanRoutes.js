const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getSupportPlans,
  getSupportPlanByUserId,
  createSupportPlan,
  updateSupportPlan,
  deleteSupportPlan,
  upsertSupportPlan
} = require('../scripts/supportPlanController');

const router = express.Router();

// 個別支援計画一覧取得
router.get('/', authenticateToken, getSupportPlans);

// 特定ユーザーの個別支援計画取得
router.get('/user/:userId', authenticateToken, getSupportPlanByUserId);

// 個別支援計画作成
router.post('/', authenticateToken, createSupportPlan);

// 個別支援計画更新
router.put('/:id', authenticateToken, updateSupportPlan);

// 個別支援計画削除
router.delete('/:id', authenticateToken, deleteSupportPlan);

// 個別支援計画作成または更新（upsert）
router.post('/upsert', authenticateToken, upsertSupportPlan);

module.exports = router;
