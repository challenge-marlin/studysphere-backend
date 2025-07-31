-- サテライトテーブルに電話番号カラムを追加するマイグレーション
-- 実行日時: 2024年12月

USE `curriculum-portal`;

-- サテライトテーブルに電話番号カラムを追加
ALTER TABLE `satellites` 
ADD COLUMN `phone` VARCHAR(20) DEFAULT NULL COMMENT '拠点電話番号' 
AFTER `address`;

-- 既存のサンプルデータに電話番号を設定（オプション）
UPDATE `satellites` SET `phone` = '03-1234-5678' WHERE `name` = '東京本校';
UPDATE `satellites` SET `phone` = '06-1234-5678' WHERE `name` = '大阪支校';
UPDATE `satellites` SET `phone` = '052-1234-5678' WHERE `name` = '名古屋支校';
UPDATE `satellites` SET `phone` = '03-9876-5432' WHERE `name` = 'テックサポート東京オフィス';
UPDATE `satellites` SET `phone` = '06-9876-5432' WHERE `name` = 'テックサポート大阪オフィス';

-- インデックスを追加（電話番号での検索を高速化）
CREATE INDEX `idx_satellite_phone` ON `satellites` (`phone`); 