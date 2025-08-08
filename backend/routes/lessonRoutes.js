const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getLessons,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  updateLessonOrder,
  downloadLessonFile,
  downloadLessonFolder,
  getLessonFiles,
  downloadIndividualFile,
  upload,
} = require('../scripts/lessonController');

const router = express.Router();

router.get('/', authenticateToken, getLessons);
router.get('/:id', authenticateToken, getLessonById);
router.post('/', authenticateToken, requireAdmin, upload.single('file'), createLesson);
router.put('/:id', authenticateToken, requireAdmin, upload.single('file'), updateLesson);
router.delete('/:id', authenticateToken, requireAdmin, deleteLesson);
router.put('/order', authenticateToken, requireAdmin, updateLessonOrder);
router.get('/:id/download', authenticateToken, downloadLessonFile);
router.get('/:id/download-folder', authenticateToken, downloadLessonFolder);
router.get('/:id/files', authenticateToken, getLessonFiles);
router.post('/download-file', authenticateToken, downloadIndividualFile);

module.exports = router;


