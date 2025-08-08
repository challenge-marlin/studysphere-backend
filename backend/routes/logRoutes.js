const express = require('express');
const {
  getLogFiles,
  getLogContent,
  downloadLogFile,
  deleteLogFile,
  cleanupOldLogs,
  getLogStats,
} = require('../scripts/logController');

const router = express.Router();

router.get('/', getLogFiles);
router.get('/:filename', getLogContent);
router.get('/:filename/download', downloadLogFile);
router.delete('/:filename', deleteLogFile);
router.post('/cleanup', cleanupOldLogs);
router.get('/stats', getLogStats);

module.exports = router;


