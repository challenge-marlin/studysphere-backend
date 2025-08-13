const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getCurriculumPaths,
  getCurriculumPathById,
  createCurriculumPath,
  updateCurriculumPath,
  deleteCurriculumPath,
  getAvailableCourses
} = require('../scripts/curriculumPathController');

const router = express.Router();

// カリキュラムパス管理API
router.get('/', authenticateToken, getCurriculumPaths);
router.get('/available-courses', authenticateToken, getAvailableCourses);
router.get('/:id', authenticateToken, getCurriculumPathById);
router.post('/', authenticateToken, requireAdmin, createCurriculumPath);
router.put('/:id', authenticateToken, requireAdmin, updateCurriculumPath);
router.delete('/:id', authenticateToken, requireAdmin, deleteCurriculumPath);

module.exports = router;
