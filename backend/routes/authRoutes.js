const express = require('express');
const { loginValidation, handleValidationErrors } = require('../middleware/validation');
const { adminLogin, instructorLogin, getUserCompaniesAndSatellites, getUserCompanySatelliteInfo, refreshToken, logout } = require('../scripts/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', loginValidation, handleValidationErrors, async (req, res) => {
  const { username, password } = req.body;
  const result = await adminLogin(username, password);
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// 指導員ログイン（企業・拠点選択）
router.post('/instructor-login', loginValidation, handleValidationErrors, async (req, res) => {
  const { username, password, companyId, satelliteId } = req.body;
  const result = await instructorLogin(username, password, companyId, satelliteId);
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// ユーザーの企業・拠点情報取得
router.get('/user-companies/:username', async (req, res) => {
  const { username } = req.params;
  const result = await getUserCompaniesAndSatellites(username);
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// 現在のユーザーの企業・拠点情報取得
router.get('/user-info', authenticateToken, async (req, res) => {
  const userId = req.user.user_id;
  const result = await getUserCompanySatelliteInfo(userId);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  const result = await refreshToken(refresh_token);
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

router.post('/logout', async (req, res) => {
  const { refresh_token } = req.body;
  const result = await logout(refresh_token);
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

module.exports = router;


