-- 企業テーブルにトークンフィールドを追加するマイグレーション
-- 管理符号としてのトークン（期限なし、ユニーク）

USE `curriculum-portal`;

-- 企業テーブルにトークンフィールドを追加
ALTER TABLE `companies` 
ADD COLUMN `token` VARCHAR(14) DEFAULT NULL COMMENT '管理符号トークン（形式：XXXX-XXXX-XXXX）' AFTER `phone`,
ADD COLUMN `token_issued_at` DATETIME DEFAULT NULL COMMENT 'トークン発行日時' AFTER `token`,
ADD UNIQUE KEY `unique_company_token` (`token`);

-- 既存の企業レコードにトークンを生成して設定
UPDATE `companies` 
SET 
  `token` = CONCAT(
    UPPER(SUBSTRING(MD5(RAND()) FROM 1 FOR 4)), '-',
    UPPER(SUBSTRING(MD5(RAND()) FROM 1 FOR 4)), '-',
    UPPER(SUBSTRING(MD5(RAND()) FROM 1 FOR 4))
  ),
  `token_issued_at` = NOW()
WHERE `token` IS NULL;

-- トークンの重複を避けるため、既存のトークンを更新
UPDATE `companies` c1
JOIN (
  SELECT id, token
  FROM `companies` c2
  WHERE c2.token IN (
    SELECT token 
    FROM `companies` 
    GROUP BY token 
    HAVING COUNT(*) > 1
  )
) duplicates ON c1.id = duplicates.id
SET c1.token = CONCAT(
  UPPER(SUBSTRING(MD5(CONCAT(RAND(), c1.id)) FROM 1 FOR 4)), '-',
  UPPER(SUBSTRING(MD5(CONCAT(RAND(), c1.id)) FROM 1 FOR 4)), '-',
  UPPER(SUBSTRING(MD5(CONCAT(RAND(), c1.id)) FROM 1 FOR 4))
);

-- 企業テーブルから不要なoffice_type_idフィールドを削除（拠点に移動済み）
ALTER TABLE `companies` 
DROP FOREIGN KEY `companies_ibfk_1`,
DROP COLUMN `office_type_id`;

-- 拠点テーブルにoffice_type_idフィールドを追加（まだ存在しない場合）
ALTER TABLE `satellites` 
ADD COLUMN `office_type_id` INT DEFAULT NULL COMMENT '事業所タイプID' AFTER `address`,
ADD FOREIGN KEY (`office_type_id`) REFERENCES `office_types`(`id`) ON DELETE SET NULL;

-- 拠点テーブルにトークンフィールドを追加（まだ存在しない場合）
ALTER TABLE `satellites` 
ADD COLUMN `token` VARCHAR(14) DEFAULT NULL COMMENT '拠点トークン（形式：XXXX-XXXX-XXXX）' AFTER `office_type_id`,
ADD COLUMN `contract_type` ENUM('30days', '90days', '1year') DEFAULT '30days' COMMENT '契約タイプ' AFTER `token`,
ADD UNIQUE KEY `unique_satellite_token` (`token`);

-- 既存の拠点レコードにトークンを生成して設定
UPDATE `satellites` 
SET 
  `token` = CONCAT(
    UPPER(SUBSTRING(MD5(RAND()) FROM 1 FOR 4)), '-',
    UPPER(SUBSTRING(MD5(RAND()) FROM 1 FOR 4)), '-',
    UPPER(SUBSTRING(MD5(RAND()) FROM 1 FOR 4))
  )
WHERE `token` IS NULL;

-- 拠点トークンの重複を避けるため、既存のトークンを更新
UPDATE `satellites` s1
JOIN (
  SELECT id, token
  FROM `satellites` s2
  WHERE s2.token IN (
    SELECT token 
    FROM `satellites` 
    GROUP BY token 
    HAVING COUNT(*) > 1
  )
) duplicates ON s1.id = duplicates.id
SET s1.token = CONCAT(
  UPPER(SUBSTRING(MD5(CONCAT(RAND(), s1.id)) FROM 1 FOR 4)), '-',
  UPPER(SUBSTRING(MD5(CONCAT(RAND(), s1.id)) FROM 1 FOR 4)), '-',
  UPPER(SUBSTRING(MD5(CONCAT(RAND(), s1.id)) FROM 1 FOR 4))
); 