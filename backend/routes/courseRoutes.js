const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  updateCourseOrder,
} = require('../scripts/courseController');

const router = express.Router();

router.get('/', authenticateToken, getCourses);
router.get('/:id', authenticateToken, getCourseById);
router.post('/', authenticateToken, requireAdmin, createCourse);
router.put('/:id', authenticateToken, requireAdmin, updateCourse);
router.delete('/:id', authenticateToken, requireAdmin, deleteCourse);
router.put('/order', authenticateToken, requireAdmin, updateCourseOrder);

module.exports = router;


