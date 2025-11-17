const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const supportPlanController = require('../scripts/supportPlanController');

const router = express.Router();

// 個別支援計画一覧取得
router.get('/', authenticateToken, supportPlanController.getSupportPlans);

// 特定ユーザーの個別支援計画取得
router.get('/user/:userId', authenticateToken, supportPlanController.getSupportPlanByUserId);

// 個別支援計画作成
router.post('/', authenticateToken, supportPlanController.createSupportPlan);

// 個別支援計画更新
router.put('/:id', authenticateToken, supportPlanController.updateSupportPlan);

// 個別支援計画削除
router.delete('/:id', authenticateToken, supportPlanController.deleteSupportPlan);

// 個別支援計画作成または更新（upsert）
router.post('/upsert', authenticateToken, supportPlanController.upsertSupportPlan);

module.exports = router;
