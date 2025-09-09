-- ファイルタイプ修正スクリプト
-- S3キーの拡張子に基づいてfile_typeを正しく設定する

-- .txtファイルのfile_typeを'text/plain'に修正
UPDATE lessons 
SET file_type = 'text/plain', updated_at = CURRENT_TIMESTAMP
WHERE s3_key LIKE '%.txt' AND file_type != 'text/plain';

-- .mdファイルのfile_typeを'md'に修正
UPDATE lessons 
SET file_type = 'md', updated_at = CURRENT_TIMESTAMP
WHERE s3_key LIKE '%.md' AND file_type != 'md';

-- .rtfファイルのfile_typeを'application/rtf'に修正
UPDATE lessons 
SET file_type = 'application/rtf', updated_at = CURRENT_TIMESTAMP
WHERE s3_key LIKE '%.rtf' AND file_type != 'application/rtf';

-- .pdfファイルのfile_typeを'pdf'に修正
UPDATE lessons 
SET file_type = 'pdf', updated_at = CURRENT_TIMESTAMP
WHERE s3_key LIKE '%.pdf' AND file_type != 'pdf';

-- .docxファイルのfile_typeを'docx'に修正
UPDATE lessons 
SET file_type = 'docx', updated_at = CURRENT_TIMESTAMP
WHERE s3_key LIKE '%.docx' AND file_type != 'docx';

-- .pptxファイルのfile_typeを'pptx'に修正
UPDATE lessons 
SET file_type = 'pptx', updated_at = CURRENT_TIMESTAMP
WHERE s3_key LIKE '%.pptx' AND file_type != 'pptx';

-- 修正結果を確認
SELECT 
    id, 
    title, 
    s3_key, 
    file_type,
    CASE 
        WHEN s3_key LIKE '%.txt' THEN 'text/plain'
        WHEN s3_key LIKE '%.md' THEN 'md'
        WHEN s3_key LIKE '%.rtf' THEN 'application/rtf'
        WHEN s3_key LIKE '%.pdf' THEN 'pdf'
        WHEN s3_key LIKE '%.docx' THEN 'docx'
        WHEN s3_key LIKE '%.pptx' THEN 'pptx'
        ELSE 'unknown'
    END as expected_file_type
FROM lessons 
WHERE s3_key IS NOT NULL AND status != 'deleted'
ORDER BY id;
