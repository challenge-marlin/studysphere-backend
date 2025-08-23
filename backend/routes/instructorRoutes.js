const express = require('express');
const {
  getInstructorSpecializations,
  setInstructorSpecializations,
  deleteInstructorSpecialization,
  setInstructorAsManager,
  removeInstructorAsManager,
} = require('../scripts/instructorSpecializationController');

const router = express.Router();

// 指導員の専門分野一覧取得
router.get('/:userId/specializations', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const result = await getInstructorSpecializations(userId);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    data: result.data,
    ...(result.error && { error: result.error }),
  });
});

// 指導員専門分野一括設定
router.post('/:userId/specializations', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { specializations } = req.body;
  if (!specializations || !Array.isArray(specializations)) {
    return res.status(400).json({ success: false, message: '専門分野の配列は必須です', error: 'Specializations array is required' });
  }
  const result = await setInstructorSpecializations(userId, specializations);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    data: result.data,
    ...(result.error && { error: result.error }),
  });
});

// 指導員専門分野削除
router.delete('/:userId/specializations/:specializationId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const specializationId = parseInt(req.params.specializationId);
  const result = await deleteInstructorSpecialization(specializationId, userId);
  res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

// 指導員を拠点管理者に設定
router.post('/:instructorId/set-manager/:satelliteId', async (req, res) => {
  try {
    const instructorId = parseInt(req.params.instructorId);
    const satelliteId = parseInt(req.params.satelliteId);
    
    if (!instructorId || !satelliteId) {
      return res.status(400).json({
        success: false,
        message: '指導員IDと拠点IDは必須です'
      });
    }
    
    const result = await setInstructorAsManager(satelliteId, instructorId);
    res.status(result.success ? 200 : 400).json({
      success: result.success,
      message: result.message,
      ...(result.data && { data: result.data }),
      ...(result.error && { error: result.error }),
    });
  } catch (error) {
    console.error('Set instructor as manager route error:', error);
    res.status(500).json({
      success: false,
      message: '指導員管理者設定処理中にエラーが発生しました',
      error: error.message
    });
  }
});

// 指導員の拠点管理者権限を解除
router.post('/:instructorId/remove-manager/:satelliteId', async (req, res) => {
  try {
    const instructorId = parseInt(req.params.instructorId);
    const satelliteId = parseInt(req.params.satelliteId);
    
    if (!instructorId || !satelliteId) {
      return res.status(400).json({
        success: false,
        message: '指導員IDと拠点IDは必須です'
      });
    }
    
    const result = await removeInstructorAsManager(satelliteId, instructorId);
    res.status(result.success ? 200 : 400).json({
      success: result.success,
      message: result.message,
      ...(result.data && { data: result.data }),
      ...(result.error && { error: result.error }),
    });
  } catch (error) {
    console.error('Remove instructor as manager route error:', error);
    res.status(500).json({
      success: false,
      message: '指導員管理者解除処理中にエラーが発生しました',
      error: error.message
    });
  }
});

module.exports = router;


