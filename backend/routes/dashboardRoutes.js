const express = require('express');
const { getSystemOverview, getCompanyStats, getAlerts } = require('../scripts/dashboardController');

const router = express.Router();

// ダッシュボードのメインエンドポイント（フロントエンドとの互換性のため）
router.get('/', async (req, res) => {
  try {
    // システム概要データを取得
    const result = await getSystemOverview();
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: 'ダッシュボードデータを正常に取得しました'
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: result.message || 'ダッシュボードデータの取得に失敗しました', 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('ダッシュボードメインエンドポイントエラー:', error);
    res.status(500).json({
      success: false,
      message: 'ダッシュボードデータの取得中にエラーが発生しました',
      error: error.message
    });
  }
});

router.get('/overview', async (req, res) => {
  const result = await getSystemOverview();
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({ message: result.message, error: result.error });
  }
});

router.get('/company/:id', async (req, res) => {
  const companyId = parseInt(req.params.id);
  const result = await getCompanyStats(companyId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json({
    ...(result.data && { ...result }),
    ...(!result.success && { message: result.message, error: result.error }),
  });
});

router.get('/alerts', async (req, res) => {
  const result = await getAlerts();
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({ message: result.message, error: result.error });
  }
});

module.exports = router;


