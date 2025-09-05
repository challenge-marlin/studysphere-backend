-- 学習データの状態確認用SQLクエリ

-- 1. コーステーブルの確認
SELECT '=== コーステーブル ===' as info;
SELECT * FROM courses;

-- 2. レッスンテーブルの確認
SELECT '=== レッスンテーブル ===' as info;
SELECT * FROM lessons;

-- 3. 動画テーブルの確認
SELECT '=== 動画テーブル ===' as info;
SELECT * FROM lesson_videos;

-- 4. 利用者とコースの関連付け確認
SELECT '=== 利用者とコースの関連付け ===' as info;
SELECT * FROM user_courses;

-- 5. レッスン進捗の確認
SELECT '=== レッスン進捗 ===' as info;
SELECT * FROM user_lesson_progress;

-- 6. 特定の利用者（ID: 98）の学習データ確認
SELECT '=== 利用者ID: 98の学習データ ===' as info;
SELECT 
  u.id as user_id,
  u.username,
  uc.course_id,
  c.title as course_title,
  uc.status as enrollment_status,
  uc.progress_percentage
FROM users u
LEFT JOIN user_courses uc ON u.id = uc.user_id
LEFT JOIN courses c ON uc.course_id = c.id
WHERE u.id = 98;
