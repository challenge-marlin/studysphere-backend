-- メッセージ機能用テーブルの追加・更新スクリプト

USE `curriculum-portal`;

-- 個人メッセージテーブル（存在しない場合のみ作成）
CREATE TABLE IF NOT EXISTS `personal_messages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'メッセージID',
    `sender_id` INT NOT NULL COMMENT '送信者ID',
    `receiver_id` INT NOT NULL COMMENT '受信者ID',
    `message` TEXT NOT NULL COMMENT 'メッセージ内容',
    `is_read` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '既読フラグ',
    `read_at` TIMESTAMP NULL DEFAULT NULL COMMENT '既読日時',
    `expires_at` DATETIME NOT NULL COMMENT '有効期限（日本時間24:30）',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    FOREIGN KEY (`sender_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`receiver_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    INDEX `idx_sender_id` (`sender_id`),
    INDEX `idx_receiver_id` (`receiver_id`),
    INDEX `idx_is_read` (`is_read`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='個人メッセージテーブル';

-- アナウンスメッセージテーブルにexpires_atカラムを追加（存在しない場合のみ）
ALTER TABLE `announcements` 
ADD COLUMN IF NOT EXISTS `expires_at` DATETIME NOT NULL COMMENT '有効期限（日本時間24:30）' AFTER `created_by`,
ADD INDEX IF NOT EXISTS `idx_expires_at` (`expires_at`);

-- 個人メッセージの自動削除イベント（存在しない場合のみ作成）
CREATE EVENT IF NOT EXISTS `cleanup_expired_personal_messages`
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 30 MINUTE
DO
    DELETE FROM `personal_messages` 
    WHERE `expires_at` < CONVERT_TZ(NOW(), '+00:00', '+09:00');

-- アナウンスメッセージの自動削除イベント（存在しない場合のみ作成）
CREATE EVENT IF NOT EXISTS `cleanup_expired_announcements`
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 30 MINUTE
DO
    DELETE FROM `announcements` 
    WHERE `expires_at` < CONVERT_TZ(NOW(), '+00:00', '+09:00');

-- イベントスケジューラーを有効化
SET GLOBAL event_scheduler = ON;

-- テーブル作成確認
SELECT 'personal_messages' as table_name, COUNT(*) as record_count FROM personal_messages
UNION ALL
SELECT 'announcements' as table_name, COUNT(*) as record_count FROM announcements;
