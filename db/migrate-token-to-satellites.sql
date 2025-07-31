-- 企業から拠点にトークン情報を移行するスクリプト
-- 実行前に必ずバックアップを取得してください

USE `curriculum-portal`;

-- 1. 拠点テーブルにトークン関連カラムを追加
ALTER TABLE `satellites` 
ADD COLUMN `token_issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'トークン発行日' AFTER `manager_ids`,
ADD COLUMN `token_expiry_at` DATETIME NOT NULL DEFAULT DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 YEAR) COMMENT 'トークン有効期限' AFTER `token_issued_at`;

-- 2. 企業のトークン情報を拠点に移行
UPDATE satellites s
JOIN companies c ON s.company_id = c.id
SET 
  s.token_issued_at = c.token_issued_at,
  s.token_expiry_at = c.token_expiry_at
WHERE c.token_issued_at IS NOT NULL AND c.token_expiry_at IS NOT NULL;

-- 3. 企業テーブルからトークン関連カラムを削除
ALTER TABLE `companies` 
DROP COLUMN `token_issued_at`,
DROP COLUMN `token_expiry_at`,
DROP COLUMN `max_users`;

-- 移行完了確認クエリ
SELECT '企業テーブル構造' as check_type, COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'curriculum-portal' AND TABLE_NAME = 'companies'
ORDER BY ORDINAL_POSITION;

SELECT '拠点テーブル構造' as check_type, COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'curriculum-portal' AND TABLE_NAME = 'satellites'
ORDER BY ORDINAL_POSITION;

SELECT '拠点のトークン情報' as check_type, id, name, token_issued_at, token_expiry_at 
FROM satellites 
LIMIT 5; 