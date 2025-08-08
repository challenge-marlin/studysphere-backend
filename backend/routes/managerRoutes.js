const express = require('express');
const { getManagerSatellites } = require('../scripts/satelliteController');

const router = express.Router();

// 管理者が管理する拠点一覧取得（後方互換のために維持）
router.get('/:managerId/satellites', async (req, res) => {
  const managerId = parseInt(req.params.managerId);
  const result = await getManagerSatellites(managerId);
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(result.statusCode || 404).json({ message: result.message, error: result.error });
  }
});

module.exports = router;


