-- MDファイルのfile_typeを修正するSQL

-- ステップ1: 問題のあるレッスンを確認
SELECT 
    id,
    title,
    s3_key,
    file_type,
    CASE 
        WHEN s3_key LIKE '%.md' THEN 'MDファイル（要修正）'
        WHEN s3_key LIKE '%.pdf' THEN 'PDFファイル'
        ELSE 'その他'
    END as actual_type
FROM lessons
WHERE status != 'deleted'
    AND s3_key LIKE '%.md'
    AND file_type != 'md'
ORDER BY id;

-- ステップ2: MDファイルのfile_typeを'md'に修正
UPDATE lessons
SET file_type = 'md',
    updated_at = CURRENT_TIMESTAMP
WHERE status != 'deleted'
    AND s3_key LIKE '%.md'
    AND file_type != 'md';

-- ステップ3: 修正結果を確認
SELECT 
    id,
    title,
    s3_key,
    file_type,
    CASE 
        WHEN s3_key LIKE '%.md' AND file_type = 'md' THEN '正常 ✓'
        WHEN s3_key LIKE '%.pdf' AND file_type IN ('pdf', 'application/pdf') THEN '正常 ✓'
        ELSE '要確認 ✗'
    END as status
FROM lessons
WHERE status != 'deleted'
ORDER BY id;

-- ステップ4: lesson_text_video_linksのtext_file_keyも確認
SELECT 
    ltv.id,
    ltv.lesson_id,
    ltv.text_file_key,
    l.file_type as lesson_file_type,
    CASE 
        WHEN ltv.text_file_key LIKE '%.md' THEN 'MD'
        WHEN ltv.text_file_key LIKE '%.pdf' THEN 'PDF'
        ELSE 'その他'
    END as link_file_type
FROM lesson_text_video_links ltv
LEFT JOIN lessons l ON ltv.lesson_id = l.id
ORDER BY ltv.lesson_id;

