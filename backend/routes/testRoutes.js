const express = require('express');
const { getCourses, createCourse } = require('../scripts/courseController');

const router = express.Router();

// ヘルスチェック用エンドポイント
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'curriculum-portal-backend'
  });
});

// テスト用エンドポイント（認証なし）
router.post('/courses', createCourse);
router.get('/courses', getCourses);

module.exports = router;


