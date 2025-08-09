const express = require('express');
const {
  recordOperationLog,
  getOperationLogs,
  getOperationLogStats,
  exportOperationLogs,
  clearOperationLogs,
  cleanupDuplicateOperationLogs,
} = require('../scripts/operationLogController');

const router = express.Router();

router.post('/', recordOperationLog);
router.get('/', getOperationLogs);
router.get('/stats', getOperationLogStats);
router.get('/export', exportOperationLogs);
router.delete('/', clearOperationLogs);
router.post('/cleanup-duplicates', cleanupDuplicateOperationLogs);

module.exports = router;


