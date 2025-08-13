const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getLessonVideos,
  getLessonVideoById,
  createLessonVideo,
  updateLessonVideo,
  deleteLessonVideo,
  updateLessonVideoOrder,
  bulkUpsertLessonVideos,
} = require('../scripts/lessonVideoController');

const router = express.Router();

// レッスン動画の取得
router.get('/lesson/:lessonId', authenticateToken, getLessonVideos);
router.get('/:id', authenticateToken, getLessonVideoById);

// レッスン動画の管理（管理者のみ）
router.post('/', authenticateToken, requireAdmin, createLessonVideo);
router.put('/:id', authenticateToken, requireAdmin, updateLessonVideo);
router.delete('/:id', authenticateToken, requireAdmin, deleteLessonVideo);
router.put('/order', authenticateToken, requireAdmin, updateLessonVideoOrder);

// 複数動画の一括作成・更新
router.post('/bulk-upsert', authenticateToken, requireAdmin, bulkUpsertLessonVideos);

module.exports = router;
