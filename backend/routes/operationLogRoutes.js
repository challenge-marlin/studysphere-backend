const express = require('express');
const {
  recordOperationLog,
  getOperationLogs,
  getOperationLogStats,
  exportOperationLogs,
  clearOperationLogs,
} = require('../scripts/operationLogController');

const router = express.Router();

router.post('/', recordOperationLog);
router.get('/', getOperationLogs);
router.get('/stats', getOperationLogStats);
router.get('/export', exportOperationLogs);
router.delete('/', clearOperationLogs);

module.exports = router;


