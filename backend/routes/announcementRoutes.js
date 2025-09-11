const express = require('express');
const router = express.Router();
const AnnouncementController = require('../scripts/announcementController');
const { authenticateToken } = require('../middleware/auth');

// 利用者用：アナウンス一覧を取得
router.get('/user', authenticateToken, AnnouncementController.getUserAnnouncements);

// 利用者用：アナウンスを既読にする
router.put('/user/:announcement_id/read', authenticateToken, AnnouncementController.markAsRead);

// 利用者用：全アナウンスを既読にする
router.put('/user/read-all', authenticateToken, AnnouncementController.markAllAsRead);

// 管理者用：アナウンス一覧を取得
router.get('/admin', authenticateToken, AnnouncementController.getAdminAnnouncements);

// 管理者用：アナウンス詳細を取得
router.get('/admin/:announcement_id', authenticateToken, AnnouncementController.getAnnouncementDetail);

// 管理者用：アナウンス作成
router.post('/admin/create', authenticateToken, AnnouncementController.createAnnouncement);

// 管理者用：利用者一覧取得（アナウンス送信用）
router.get('/admin/users', authenticateToken, AnnouncementController.getUsersForAnnouncement);

module.exports = router;
