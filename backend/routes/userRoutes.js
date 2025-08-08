const express = require('express');
const {
  getUsers,
  getTopUsersByCompany,
  getTeachersByCompany,
  getUserSatellites,
  getSatelliteUsers,
  addSatelliteToUser,
  removeSatelliteFromUser,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
} = require('../scripts/userController');

const router = express.Router();

// ユーザー一覧
router.get('/', async (req, res) => {
  const result = await getUsers();
  if (result.success) {
    res.json(result.data.users);
  } else {
    res.status(500).json({
      message: result.message,
      error: result.error,
    });
  }
});

// ユーザー作成
router.post('/', async (req, res) => {
  try {
    const result = await createUser(req.body);
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'ユーザーの作成に失敗しました', error: error.message });
  }
});

// 企業別最上位ユーザー
router.get('/top-by-company', async (req, res) => {
  const result = await getTopUsersByCompany();
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({ message: result.message, error: result.error });
  }
});

// 企業別教師数
router.get('/teachers-by-company', async (req, res) => {
  const result = await getTeachersByCompany();
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({ message: result.message, error: result.error });
  }
});

// パスワードリセット
router.post('/:userId/reset-password', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await resetUserPassword(userId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'パスワードリセットに失敗しました', error: error.message });
  }
});

// ユーザー更新
router.put('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await updateUser(userId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'ユーザーの更新に失敗しました', error: error.message });
  }
});

// 所属拠点一覧
router.get('/:userId/satellites', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const result = await getUserSatellites(userId);
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(404).json({ message: result.message, error: result.error });
  }
});

// 拠点にユーザーを追加
router.post('/:userId/satellites', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { satellite_id } = req.body;
  const result = await addSatelliteToUser(userId, satellite_id);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

// ユーザーから拠点を削除
router.delete('/:userId/satellites/:satelliteId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const satelliteId = parseInt(req.params.satelliteId);
  const result = await removeSatelliteFromUser(userId, satelliteId);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

// ユーザー削除
router.delete('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: '有効なユーザーIDが指定されていません' });
    }
    const result = await deleteUser(userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'ユーザーの削除に失敗しました', error: error.message });
  }
});

module.exports = router;


