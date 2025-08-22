const express = require('express');
const { authenticateToken } = require('../middleware/auth');
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
  changeInstructorPassword,
  issueTemporaryPassword,
  verifyTemporaryPassword,
  updateLoginCodes,
  getInstructorSpecializations,
  addInstructorSpecialization,
  updateInstructorSpecialization,
  deleteInstructorSpecialization,
  getSatelliteUserInstructorRelations,
  getSatelliteAvailableInstructors,
  updateUserInstructor,
  bulkUpdateUserInstructors,
  bulkRemoveUserInstructors,
  getSatelliteUsersForHomeSupport,
  getSatelliteHomeSupportUsers,
  bulkUpdateHomeSupportFlag,
  removeHomeSupportFlag,
  getSatelliteInstructorsForHomeSupport
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

// 指導員のパスワード変更
router.post('/:userId/change-password', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '現在のパスワードと新しいパスワードは必須です'
      });
    }
    
    const result = await changeInstructorPassword(userId, currentPassword, newPassword);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'パスワード変更に失敗しました', error: error.message });
  }
});

// 一時パスワード発行
router.post('/:userId/issue-temp-password', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await issueTemporaryPassword(userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '一時パスワード発行に失敗しました', error: error.message });
  }
});

// 一時パスワード検証
router.post('/verify-temp-password', async (req, res) => {
  try {
    const { loginCode, tempPassword } = req.body;
    
    if (!loginCode || !tempPassword) {
      return res.status(400).json({
        success: false,
        message: 'ログインコードとパスワードは必須です'
      });
    }
    
    const result = await verifyTemporaryPassword(loginCode, tempPassword);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'パスワード検証に失敗しました', error: error.message });
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

// 指導員の専門分野一覧取得
router.get('/:userId/specializations', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await getInstructorSpecializations(userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '専門分野の取得に失敗しました', error: error.message });
  }
});

// 指導員の専門分野追加
router.post('/:userId/specializations', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { specialization } = req.body;
    
    if (!specialization) {
      return res.status(400).json({
        success: false,
        message: '専門分野の内容は必須です'
      });
    }
    
    const result = await addInstructorSpecialization(userId, specialization);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '専門分野の追加に失敗しました', error: error.message });
  }
});

// 指導員の専門分野更新
router.put('/:userId/specializations/:specializationId', async (req, res) => {
  try {
    const specializationId = parseInt(req.params.specializationId);
    const { specialization } = req.body;
    
    if (!specialization) {
      return res.status(400).json({
        success: false,
        message: '専門分野の内容は必須です'
      });
    }
    
    const result = await updateInstructorSpecialization(specializationId, specialization);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '専門分野の更新に失敗しました', error: error.message });
  }
});

// 指導員の専門分野削除
router.delete('/:userId/specializations/:specializationId', async (req, res) => {
  try {
    const specializationId = parseInt(req.params.specializationId);
    const result = await deleteInstructorSpecialization(specializationId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '専門分野の削除に失敗しました', error: error.message });
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

// ログインコード更新
router.post('/update-login-codes', async (req, res) => {
  try {
    const result = await updateLoginCodes();
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'ログインコードの更新に失敗しました', error: error.message });
  }
});

// 拠点内の利用者と担当指導員の関係を取得
router.get('/satellite/:satelliteId/instructor-relations', async (req, res) => {
  try {
    const satelliteId = parseInt(req.params.satelliteId);
    const result = await getSatelliteUserInstructorRelations(satelliteId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '拠点利用者担当指導員関係の取得に失敗しました', 
      error: error.message 
    });
  }
});

// 拠点内の利用可能な指導員一覧を取得
router.get('/satellite/:satelliteId/available-instructors', async (req, res) => {
  try {
    const satelliteId = parseInt(req.params.satelliteId);
    const result = await getSatelliteAvailableInstructors(satelliteId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '拠点利用可能指導員の取得に失敗しました', 
      error: error.message 
    });
  }
});

// 個別利用者の担当指導員を変更
router.put('/:userId/instructor', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { instructorId } = req.body;
    
    const result = await updateUserInstructor(userId, instructorId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '担当指導員の更新に失敗しました', 
      error: error.message 
    });
  }
});

// 一括で利用者の担当指導員を変更
router.put('/satellite/:satelliteId/bulk-instructor-assignment', async (req, res) => {
  try {
    const satelliteId = parseInt(req.params.satelliteId);
    const { assignments } = req.body;
    
    if (!Array.isArray(assignments)) {
      return res.status(400).json({
        success: false,
        message: 'assignmentsは配列である必要があります'
      });
    }
    
    const result = await bulkUpdateUserInstructors(satelliteId, assignments);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '一括担当指導員更新に失敗しました', 
      error: error.message 
    });
  }
});

// 拠点内の全利用者の担当指導員を一括削除
router.delete('/satellite/:satelliteId/instructors', async (req, res) => {
  try {
    const satelliteId = parseInt(req.params.satelliteId);
    const result = await bulkRemoveUserInstructors(satelliteId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '一括担当指導員削除に失敗しました', 
      error: error.message 
    });
  }
});

// 在宅支援関連のエンドポイント
// 拠点内の通所利用者一覧を取得（在宅支援追加用）
router.get('/satellite/:satelliteId/home-support-users', authenticateToken, getSatelliteUsersForHomeSupport);

// 拠点内の在宅支援利用者一覧を取得
router.get('/satellite/:satelliteId/home-support-users-list', authenticateToken, getSatelliteHomeSupportUsers);

// 拠点内の指導員一覧を取得（在宅支援用）
router.get('/satellite/:satelliteId/home-support-instructors', authenticateToken, getSatelliteInstructorsForHomeSupport);

// 在宅支援フラグを一括更新
router.post('/bulk-update-home-support', authenticateToken, bulkUpdateHomeSupportFlag);

// 在宅支援解除（単一利用者）
router.put('/:userId/remove-home-support', authenticateToken, removeHomeSupportFlag);

module.exports = router;


