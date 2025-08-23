const express = require('express');
const {
  getSatellites,
  getSatelliteById,
  getSatellitesByIds,
  getSatelliteUsers,
  createSatellite,
  updateSatellite,
  deleteSatellite,
  getSatelliteUserCount,
  getSatelliteManagers,
  getManagerSatellites,
  addManagerToSatellite,
  removeManagerFromSatellite,
  regenerateToken,
  setSatelliteManagers,
  addSatelliteManager,
  removeSatelliteManager,
  getSatelliteDisabledCourses,
  setSatelliteDisabledCourses,
} = require('../scripts/satelliteController');
const {
  getSatelliteInstructors,
  getSatelliteStats,
} = require('../scripts/instructorSpecializationController');
const {
  satelliteValidation,
  satelliteUpdateValidation,
  handleValidationErrors,
} = require('../middleware/validation');

const router = express.Router();

// 一覧
router.get('/', async (req, res) => {
  const result = await getSatellites();
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// 複数ID（このルートを詳細ルートより前に定義）
router.get('/by-ids', async (req, res) => {
  const { ids } = req.query;
  if (!ids) {
    return res.status(400).json({ success: false, message: '拠点IDの配列が必要です', error: 'IDs parameter is required' });
  }
  try {
    const satelliteIds = JSON.parse(ids);
    if (!Array.isArray(satelliteIds)) {
      return res.status(400).json({ success: false, message: '拠点IDは配列形式である必要があります', error: 'IDs must be an array' });
    }
    const result = await getSatellitesByIds(satelliteIds);
    res.status(result.success ? 200 : 400).json({
      success: result.success,
      message: result.message,
      data: result.data,
      ...(result.error && { error: result.error }),
    });
  } catch (error) {
    res.status(400).json({ success: false, message: '拠点IDの形式が正しくありません', error: 'Invalid IDs format' });
  }
});

// 詳細
router.get('/:id', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await getSatelliteById(satelliteId);
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// 作成
router.post('/', satelliteValidation, handleValidationErrors, async (req, res) => {
  const result = await createSatellite(req.body);
  res.status(result.success ? 201 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// 更新
router.put('/:id', satelliteUpdateValidation, handleValidationErrors, async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await updateSatellite(satelliteId, req.body);
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// 削除
router.delete('/:id', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await deleteSatellite(satelliteId);
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

// トークン再生成
router.post('/:id/regenerate-token', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const { contract_type } = req.body;
  const result = await regenerateToken(satelliteId, contract_type);
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

// 利用者数
router.get('/:id/users/count', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await getSatelliteUserCount(satelliteId);
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(404).json({ message: result.message, error: result.error });
  }
});

// 拠点に所属するユーザー一覧取得
router.get('/:id/users', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await getSatelliteUsers(satelliteId);
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(404).json({ message: result.message, error: result.error });
  }
});

// 拠点内指導員一覧取得（専門分野含む）
router.get('/:satelliteId/instructors', async (req, res) => {
  const satelliteId = parseInt(req.params.satelliteId);
  const result = await getSatelliteInstructors(satelliteId);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    data: result.data,
    ...(result.error && { error: result.error }),
  });
});

// 拠点統計情報取得
router.get('/:satelliteId/stats', async (req, res) => {
  const satelliteId = parseInt(req.params.satelliteId);
  const result = await getSatelliteStats(satelliteId);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    data: result.data,
    ...(result.error && { error: result.error }),
  });
});

// 管理者一覧
router.get('/:id/managers', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await getSatelliteManagers(satelliteId);
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(404).json({ message: result.message, error: result.error });
  }
});


// 管理者追加
router.post('/:id/managers', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const { manager_id } = req.body;
  const result = await addManagerToSatellite(satelliteId, manager_id);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

// 管理者削除
router.delete('/:id/managers/:managerId', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const managerId = parseInt(req.params.managerId);
  const result = await removeSatelliteManager(satelliteId, managerId);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

// 管理者一括設定
router.put('/:id/managers', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const { manager_ids } = req.body;
  const result = await setSatelliteManagers(satelliteId, manager_ids);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

// 追加（別名）
router.put('/:id/add-manager', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const { manager_id } = req.body;
  if (!manager_id) {
    return res.status(400).json({ success: false, message: '管理者IDは必須です', error: 'Manager ID is required' });
  }
  const result = await addSatelliteManager(satelliteId, manager_id);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    data: result.data,
    ...(result.error && { error: result.error }),
  });
});

// 無効化コース一覧取得
router.get('/:id/disabled-courses', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const result = await getSatelliteDisabledCourses(satelliteId);
  res.status(result.success ? 200 : (result.statusCode || 400)).json(result);
});

// 無効化コース一覧更新（置換）
router.put('/:id/disabled-courses', async (req, res) => {
  const satelliteId = parseInt(req.params.id);
  const { disabled_course_ids } = req.body;
  const result = await setSatelliteDisabledCourses(satelliteId, disabled_course_ids || []);
  res.status(result.success ? 200 : (result.statusCode || 400)).json(result);
});

module.exports = router;


