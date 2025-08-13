const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getTextVideoLinks,
  getTextVideoLinkById,
  createTextVideoLink,
  updateTextVideoLink,
  deleteTextVideoLink,
  updateTextVideoLinkOrder,
  bulkUpsertTextVideoLinks,
} = require('../scripts/lessonTextVideoLinkController');

const router = express.Router();

// テキストと動画の紐づけ取得
router.get('/lesson/:lessonId', authenticateToken, getTextVideoLinks);
router.get('/:id', authenticateToken, getTextVideoLinkById);

// テキストと動画の紐づけ管理（管理者のみ）
router.post('/', authenticateToken, requireAdmin, createTextVideoLink);
router.put('/:id', authenticateToken, requireAdmin, updateTextVideoLink);
router.delete('/:id', authenticateToken, requireAdmin, deleteTextVideoLink);
router.put('/order', authenticateToken, requireAdmin, updateTextVideoLinkOrder);

// 複数紐づけの一括作成・更新
router.post('/bulk-upsert', authenticateToken, requireAdmin, bulkUpsertTextVideoLinks);

module.exports = router;
