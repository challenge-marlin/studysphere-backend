const express = require('express');
const { getCourses, createCourse } = require('../scripts/courseController');

const router = express.Router();

// テスト用エンドポイント（認証なし）
router.post('/courses', createCourse);
router.get('/courses', getCourses);

module.exports = router;


