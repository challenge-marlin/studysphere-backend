const express = require('express');
const {
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  restoreAdmin,
  permanentlyDeleteAdmin,
} = require('../scripts/adminController');

const router = express.Router();

// 管理者一覧取得
router.get('/', async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';
    const result = await getAdmins(includeDeleted);
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ success: false, message: result.message, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: '管理者一覧の取得に失敗しました', error: error.message });
  }
});

// 作成
router.post('/', async (req, res) => {
  try {
    const result = await createAdmin(req.body);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '管理者の作成に失敗しました', error: error.message });
  }
});

// 更新
router.put('/:adminId', async (req, res) => {
  try {
    const adminId = parseInt(req.params.adminId);
    const result = await updateAdmin(adminId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '管理者の更新に失敗しました', error: error.message });
  }
});

// 削除（論理）
router.delete('/:adminId', async (req, res) => {
  try {
    const adminId = parseInt(req.params.adminId);
    const result = await deleteAdmin(adminId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '管理者の削除に失敗しました', error: error.message });
  }
});

// 復元
router.post('/:adminId/restore', async (req, res) => {
  try {
    const adminId = parseInt(req.params.adminId);
    const result = await restoreAdmin(adminId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '管理者の復元に失敗しました', error: error.message });
  }
});

// 物理削除
router.delete('/:adminId/permanent', async (req, res) => {
  try {
    const adminId = parseInt(req.params.adminId);
    const result = await permanentlyDeleteAdmin(adminId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: '管理者の物理削除に失敗しました', error: error.message });
  }
});

module.exports = router;


