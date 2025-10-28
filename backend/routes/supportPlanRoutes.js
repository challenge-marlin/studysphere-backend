const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getSupportPlans,
  getSupportPlanByUserId,
  createSupportPlan,
  updateSupportPlan,
  deleteSupportPlan,
  upsertSupportPlan,
  getSatelliteSupportPlanGoalDates,
  getSatelliteSupportPlanStatus
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

// 拠点内の在宅支援利用者の個別支援計画の目標達成予定日を取得
router.get('/satellite/:satelliteId/goal-dates', authenticateToken, getSatelliteSupportPlanGoalDates);

// 拠点内の在宅支援利用者の個別支援計画状況を取得（記録がない利用者も含む）
router.get('/satellite/:satelliteId/status', authenticateToken, getSatelliteSupportPlanStatus);

module.exports = router;
