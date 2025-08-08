const express = require('express');
const { getSystemOverview, getCompanyStats, getAlerts } = require('../scripts/dashboardController');

const router = express.Router();

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


