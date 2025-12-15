-- ID32の2025/11/1～2025/11/30までの日報データを検索
-- バックエンドのgetDailyReportsメソッドと同じクエリ

SELECT 
  rsdr.*,
  ua.name as user_name,
  ua.login_code,
  ua.instructor_id,
  i.name as instructor_name
FROM remote_support_daily_records rsdr
LEFT JOIN user_accounts ua ON rsdr.user_id = ua.id
LEFT JOIN user_accounts i ON ua.instructor_id = i.id
WHERE 1=1
  AND rsdr.user_id = 32
  AND rsdr.date >= '2025-11-01'
  AND rsdr.date <= '2025-11-30'
ORDER BY rsdr.date DESC, rsdr.created_at DESC;

-- 簡易版：日報テーブルのみ（JOINなし）
SELECT 
  id,
  user_id,
  date,
  mark_start,
  mark_lunch_start,
  mark_lunch_end,
  mark_end,
  support_method,
  task_content,
  support_content,
  recorder_name,
  created_at,
  updated_at
FROM remote_support_daily_records
WHERE user_id = 32
  AND date >= '2025-11-01'
  AND date <= '2025-11-30'
ORDER BY date DESC, created_at DESC;

-- 件数確認
SELECT COUNT(*) as total_count
FROM remote_support_daily_records
WHERE user_id = 32
  AND date >= '2025-11-01'
  AND date <= '2025-11-30';

-- 日付別の件数確認
SELECT 
  date,
  COUNT(*) as count
FROM remote_support_daily_records
WHERE user_id = 32
  AND date >= '2025-11-01'
  AND date <= '2025-11-30'
GROUP BY date
ORDER BY date DESC;
