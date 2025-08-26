const express = require('express');
const router = express.Router();
const TempPasswordController = require('../scripts/tempPasswordController');
const { authenticateToken } = require('../middleware/auth');

// 指導員一覧を取得
router.get('/instructors', authenticateToken, TempPasswordController.getInstructors);

// 一時パスワード対象利用者一覧を取得
router.get('/users', authenticateToken, TempPasswordController.getUsersForTempPassword);

// 一時パスワードを一括発行
router.post('/issue', authenticateToken, TempPasswordController.issueTempPasswords);

// 一時パスワード一覧を取得
router.get('/list', authenticateToken, TempPasswordController.getTempPasswords);

// 一時パスワード状態確認（認証不要）
router.get('/status/:login_code', TempPasswordController.checkTempPasswordStatus);

module.exports = router;
