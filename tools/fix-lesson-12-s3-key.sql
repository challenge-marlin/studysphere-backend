-- レッスンID 12のlesson_text_video_linksテーブルのtext_file_keyを修正するSQLスクリプト
-- 問題: lesson_text_video_linksのtext_file_keyがlessonsテーブルのs3_keyと一致していない

-- 1. 現在の状態を確認
SELECT 
  l.id as lesson_id,
  l.title as lesson_title,
  l.s3_key as lesson_s3_key,
  ltv.id as link_id,
  ltv.text_file_key as current_text_file_key,
  ltv.video_id,
  ltv.link_order,
  CASE 
    WHEN ltv.text_file_key = l.s3_key THEN '一致'
    ELSE '不一致'
  END as status
FROM lessons l
LEFT JOIN lesson_text_video_links ltv ON l.id = ltv.lesson_id
WHERE l.id = 12
ORDER BY ltv.link_order ASC;

-- 2. lesson_text_video_linksテーブルのtext_file_keyをlessonsテーブルのs3_keyに更新
UPDATE lesson_text_video_links ltv
INNER JOIN lessons l ON ltv.lesson_id = l.id
SET ltv.text_file_key = l.s3_key,
    ltv.updated_at = CURRENT_TIMESTAMP
WHERE l.id = 12 
  AND l.s3_key IS NOT NULL
  AND ltv.text_file_key != l.s3_key;

-- 3. 更新後の状態を確認
SELECT 
  l.id as lesson_id,
  l.title as lesson_title,
  l.s3_key as lesson_s3_key,
  ltv.id as link_id,
  ltv.text_file_key as updated_text_file_key,
  ltv.video_id,
  ltv.link_order,
  CASE 
    WHEN ltv.text_file_key = l.s3_key THEN '一致'
    ELSE '不一致'
  END as status
FROM lessons l
LEFT JOIN lesson_text_video_links ltv ON l.id = ltv.lesson_id
WHERE l.id = 12
ORDER BY ltv.link_order ASC;

