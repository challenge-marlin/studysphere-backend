-- 既存データベースをJSON配列構造に移行するスクリプト
-- 実行前に必ずバックアップを取得してください

USE `curriculum-portal`;

-- 1. 拠点テーブルに管理者配列カラムを追加
ALTER TABLE `satellites` 
ADD COLUMN `manager_ids` JSON DEFAULT NULL COMMENT '管理者（ロール5）のユーザーID配列' AFTER `status`,
ADD INDEX `idx_manager_ids` ((CAST(`manager_ids` AS CHAR(100))));

-- 2. ユーザーテーブルの所属拠点をJSON配列に変更
-- 既存のsatellite_idを一時的に保持
ALTER TABLE `user_accounts` 
ADD COLUMN `satellite_ids_temp` JSON DEFAULT NULL COMMENT '所属拠点ID配列（移行用）' AFTER `satellite_id`;

-- 既存のsatellite_idをJSON配列に変換
UPDATE `user_accounts` 
SET `satellite_ids_temp` = JSON_ARRAY(`satellite_id`) 
WHERE `satellite_id` IS NOT NULL;

-- 古いsatellite_idカラムを削除し、新しいsatellite_idsカラムにリネーム
ALTER TABLE `user_accounts` 
DROP FOREIGN KEY `user_accounts_ibfk_2`,
DROP COLUMN `satellite_id`,
CHANGE COLUMN `satellite_ids_temp` `satellite_ids` JSON DEFAULT NULL COMMENT '所属拠点ID配列（複数拠点対応）',
ADD INDEX `idx_satellite_ids` ((CAST(`satellite_ids` AS CHAR(100))));

-- 3. 拠点の管理者配列を初期化（既存の管理者を適切な拠点に割り当て）
-- 例：佐藤指導員（ID: 2）を東京本校と名古屋支校の管理者に設定
UPDATE `satellites` 
SET `manager_ids` = '[2]' 
WHERE `id` = 1; -- 東京本校

UPDATE `satellites` 
SET `manager_ids` = '[3]' 
WHERE `id` = 2; -- 大阪支校

UPDATE `satellites` 
SET `manager_ids` = '[2, 3]' 
WHERE `id` = 3; -- 名古屋支校

UPDATE `satellites` 
SET `manager_ids` = '[4]' 
WHERE `id` = 4; -- テックサポート東京オフィス

UPDATE `satellites` 
SET `manager_ids` = '[4]' 
WHERE `id` = 5; -- テックサポート大阪オフィス

-- 4. 管理者の所属拠点を更新
UPDATE `user_accounts` 
SET `satellite_ids` = '[1, 3]' 
WHERE `id` = 2; -- 佐藤指導員

UPDATE `user_accounts` 
SET `satellite_ids` = '[2]' 
WHERE `id` = 3; -- 田中指導員

UPDATE `user_accounts` 
SET `satellite_ids` = '[4, 5]' 
WHERE `id` = 4; -- 山田指導員

-- 移行完了確認クエリ
SELECT '拠点の管理者配列' as check_type, id, name, manager_ids FROM satellites;
SELECT 'ユーザーの所属拠点配列' as check_type, id, name, satellite_ids FROM user_accounts WHERE satellite_ids IS NOT NULL; 