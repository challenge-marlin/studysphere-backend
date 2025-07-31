-- companiesテーブルのマイグレーション
-- 新しいフィールドを追加

USE `curriculum-portal`;

-- 既存のcompaniesテーブルに新しいフィールドを追加
ALTER TABLE `companies` 
ADD COLUMN `token` VARCHAR(14) DEFAULT NULL COMMENT 'アクセストークン（形式：XXXX-XXXX-XXXX）' AFTER `office_type_id`,
ADD COLUMN `token_issued_at` DATETIME DEFAULT NULL COMMENT 'トークン発行日' AFTER `token`,
ADD COLUMN `token_expiry_at` DATETIME DEFAULT NULL COMMENT 'トークン有効期限' AFTER `token_issued_at`,
ADD COLUMN `contract_type` ENUM('30days', '90days', '1year') DEFAULT NULL COMMENT '契約タイプ' AFTER `token_expiry_at`,
ADD COLUMN `max_users` INT NOT NULL DEFAULT 5 COMMENT '利用者上限数' AFTER `contract_type`,
ADD COLUMN `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時' AFTER `max_users`,
ADD COLUMN `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時' AFTER `created_at`,
ADD UNIQUE KEY `unique_token` (`token`);

-- 既存のレコードにデフォルト値を設定
UPDATE `companies` SET 
  `token` = NULL,
  `token_issued_at` = NULL,
  `token_expiry_at` = NULL,
  `contract_type` = '30days',
  `max_users` = 5,
  `created_at` = CURRENT_TIMESTAMP,
  `updated_at` = CURRENT_TIMESTAMP
WHERE `token` IS NULL; 