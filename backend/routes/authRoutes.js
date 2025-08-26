const express = require('express');
const { loginValidation, handleValidationErrors } = require('../middleware/validation');
const { adminLogin, instructorLogin, getUserCompaniesAndSatellites, getUserCompanySatelliteInfo, refreshToken, logout, restoreMasterUser, setSatelliteManager, reauthenticateForSatellite } = require('../scripts/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', loginValidation, handleValidationErrors, async (req, res) => {
  console.log('=== Login Route Debug ===');
  console.log('Request body:', req.body);
  console.log('Username:', req.body.username);
  console.log('Password provided:', req.body.password ? 'Yes' : 'No');
  
  const { username, password } = req.body;
  
  try {
    const result = await adminLogin(username, password);
    console.log('Login result:', result);
    
    res.status(result.statusCode || 200).json({
      success: result.success,
      message: result.message,
      ...(result.data && { data: result.data }),
      ...(result.error && { error: result.error }),
    });
  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({
      success: false,
      message: 'ログイン処理中にエラーが発生しました',
      error: error.message
    });
  }
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

// マスターユーザー復旧エンドポイント
router.post('/restore-master-user', async (req, res) => {
  try {
    const result = await restoreMasterUser();
    res.status(result.success ? 200 : 500).json({
      success: result.success,
      message: result.message,
      ...(result.data && { data: result.data }),
      ...(result.error && { error: result.error }),
    });
  } catch (error) {
    console.error('Restore master user route error:', error);
    res.status(500).json({
      success: false,
      message: 'マスターユーザー復旧処理中にエラーが発生しました',
      error: error.message
    });
  }
});

// 拠点管理者設定エンドポイント
router.post('/set-satellite-manager', async (req, res) => {
  try {
    const { satelliteId, userId } = req.body;
    
    if (!satelliteId || !userId) {
      return res.status(400).json({
        success: false,
        message: '拠点IDとユーザーIDは必須です'
      });
    }
    
    const result = await setSatelliteManager(satelliteId, userId);
    res.status(result.success ? 200 : 400).json({
      success: result.success,
      message: result.message,
      ...(result.data && { data: result.data }),
      ...(result.error && { error: result.error }),
    });
  } catch (error) {
    console.error('Set satellite manager route error:', error);
    res.status(500).json({
      success: false,
      message: '拠点管理者設定処理中にエラーが発生しました',
      error: error.message
    });
  }
});

// 拠点変更時の再認証
router.post('/reauthenticate-satellite', authenticateToken, async (req, res) => {
  const { satelliteId, userId } = req.body;
  const tokenUserId = req.user.user_id;
  
  if (!satelliteId) {
    return res.status(400).json({
      success: false,
      message: '拠点IDは必須です'
    });
  }
  
  // userIdが提供されている場合はそれを使用、そうでなければトークンから取得
  const targetUserId = userId || tokenUserId;
  
  const result = await reauthenticateForSatellite(targetUserId, satelliteId);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

module.exports = router;


