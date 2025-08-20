-- instructor_idカラムを追加するマイグレーション
-- 既存データを保持したままカラムを追加

USE `curriculum-portal`;

-- instructor_idカラムを追加（エラーが発生した場合は無視）
ALTER TABLE `user_accounts` ADD COLUMN `instructor_id` INT DEFAULT NULL;

-- 外部キー制約を追加（エラーが発生した場合は無視）
ALTER TABLE `user_accounts` ADD CONSTRAINT `fk_user_accounts_instructor_id` FOREIGN KEY (`instructor_id`) REFERENCES `user_accounts`(`id`) ON DELETE SET NULL;

-- インデックスを追加（エラーが発生した場合は無視）
ALTER TABLE `user_accounts` ADD INDEX `idx_instructor_id` (`instructor_id`);

-- 完了メッセージ
SELECT 'instructor_id column migration completed' as status;
