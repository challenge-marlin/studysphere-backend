const express = require('express');
const multer = require('multer');
const router = express.Router();
const RemoteSupportController = require('../scripts/remoteSupportController');

// multer設定（メモリ上でファイルを処理）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB制限
  }
});

// 画像アップロード（カメラ・スクリーンショット）
router.post('/upload-capture', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'screenshot', maxCount: 1 }
]), RemoteSupportController.uploadCapture);

// 勤怠打刻
router.post('/mark-attendance', RemoteSupportController.markAttendance);

// 一時パスワード監視
router.get('/check-temp-password/:loginCode', RemoteSupportController.checkTempPassword);

// 一時パスワード通知受信
router.post('/notify-temp-password', RemoteSupportController.notifyTempPassword);

// 一時パスワード通知取得
router.get('/get-temp-password-notification/:loginCode', RemoteSupportController.getTempPasswordNotification);

// 学習ページ自動ログイン
router.post('/auto-login', RemoteSupportController.autoLogin);

// 支援アプリログイン
router.post('/login', RemoteSupportController.login);

// デバッグ用：一時パスワード一覧取得
router.get('/debug/temp-passwords/:loginCode', RemoteSupportController.debugTempPasswords);

module.exports = router;
