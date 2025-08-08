const express = require('express');
const {
  getInstructorSpecializations,
  setInstructorSpecializations,
  deleteInstructorSpecialization,
} = require('../scripts/instructorSpecializationController');

const router = express.Router();

// 指導者の専門分野一覧取得
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

// 指導者専門分野一括設定
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

// 指導者専門分野削除
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

module.exports = router;


