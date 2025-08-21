const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getSatelliteUserCourses,
  getSatelliteAvailableCourses,
  getSatelliteAvailableCurriculumPaths,
  bulkAssignCoursesToUsers,
  bulkRemoveCoursesFromUsers,
  bulkAssignCurriculumPathsToUsers
} = require('../scripts/userCourseController');

const router = express.Router();

// 拠点内の利用者のコース関連付け一覧を取得
router.get('/satellite/:satelliteId/user-courses', authenticateToken, getSatelliteUserCourses);

// 拠点で利用可能なコース一覧を取得
router.get('/satellite/:satelliteId/available-courses', authenticateToken, getSatelliteAvailableCourses);

// 拠点で利用可能なカリキュラムパス一覧を取得
router.get('/satellite/:satelliteId/available-curriculum-paths', authenticateToken, getSatelliteAvailableCurriculumPaths);

// 利用者にコースを一括追加
router.post('/satellite/:satelliteId/bulk-assign-courses', authenticateToken, bulkAssignCoursesToUsers);

// 利用者からコースを一括削除
router.post('/satellite/:satelliteId/bulk-remove-courses', authenticateToken, bulkRemoveCoursesFromUsers);

// 利用者にカリキュラムパスを一括追加
router.post('/satellite/:satelliteId/bulk-assign-curriculum-paths', authenticateToken, bulkAssignCurriculumPathsToUsers);

module.exports = router;
