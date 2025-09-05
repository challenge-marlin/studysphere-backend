const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getCurrentLesson,
  updateCurrentLesson,
  pauseCurrentLesson,
  resumeCurrentLesson
} = require('../scripts/currentLessonController');

const router = express.Router();

// 現在受講中レッスンの取得
router.get('/', authenticateToken, getCurrentLesson);

// 現在受講中レッスンの更新
router.put('/', authenticateToken, updateCurrentLesson);

// 現在受講中レッスンの一時停止
router.put('/:courseId/pause', authenticateToken, pauseCurrentLesson);

// 現在受講中レッスンの再開
router.put('/:courseId/resume', authenticateToken, resumeCurrentLesson);

module.exports = router;
