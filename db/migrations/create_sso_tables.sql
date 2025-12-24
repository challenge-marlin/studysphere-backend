-- SSO機能用テーブル作成マイグレーション
-- 実行日時: 2024年

-- SSOチケット管理テーブル
CREATE TABLE IF NOT EXISTS `sso_tickets` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'チケットID',
    `ticket` VARCHAR(128) NOT NULL UNIQUE COMMENT 'チケット文字列（art-{random}形式）',
    `user_id` INT NOT NULL COMMENT 'ユーザーID（user_accounts.id）',
    `source_system` VARCHAR(100) DEFAULT NULL COMMENT '遷移元システム識別子',
    `target_system` VARCHAR(100) NOT NULL COMMENT '遷移先システム識別子',
    `context` VARCHAR(255) DEFAULT NULL COMMENT '生成コンテキスト（menu_click, transit, etc.）',
    `used` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '使用済みフラグ',
    `used_at` DATETIME DEFAULT NULL COMMENT '使用日時',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時（日本時間）',
    `expires_at` DATETIME NOT NULL COMMENT '有効期限（日本時間、通常は30-60秒後）',
    `ip_address` VARCHAR(45) DEFAULT NULL COMMENT '生成元IPアドレス',
    `user_agent` TEXT DEFAULT NULL COMMENT '生成元User-Agent',
    INDEX `idx_ticket` (`ticket`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_target_system` (`target_system`),
    INDEX `idx_expires_at` (`expires_at`),
    INDEX `idx_used` (`used`),
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='SSOワンタイムチケット管理テーブル';

-- 信頼システム管理テーブル
CREATE TABLE IF NOT EXISTS `sso_trusted_systems` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'システムID',
    `system_key` VARCHAR(100) NOT NULL UNIQUE COMMENT 'システム識別子（system_a, system_b, support_app等）',
    `system_name` VARCHAR(255) NOT NULL COMMENT 'システム表示名',
    `base_url` VARCHAR(512) NOT NULL COMMENT 'ベースURL（リダイレクト先検証用）',
    `landing_path` VARCHAR(255) DEFAULT '/landing' COMMENT 'ランディングパス',
    `description` TEXT DEFAULT NULL COMMENT 'システム説明',
    `enabled` BOOLEAN NOT NULL DEFAULT TRUE COMMENT '有効フラグ',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時（日本時間）',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時（日本時間）',
    `created_by` INT DEFAULT NULL COMMENT '作成者ID',
    `updated_by` INT DEFAULT NULL COMMENT '更新者ID',
    INDEX `idx_system_key` (`system_key`),
    INDEX `idx_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='SSO連携信頼システム管理テーブル';

-- SSO監査ログテーブル
CREATE TABLE IF NOT EXISTS `sso_audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ログID',
    `user_id` INT NOT NULL COMMENT 'ユーザーID',
    `ticket_id` INT DEFAULT NULL COMMENT 'チケットID（sso_tickets.id）',
    `source_system` VARCHAR(100) DEFAULT NULL COMMENT '遷移元システム',
    `target_system` VARCHAR(100) NOT NULL COMMENT '遷移先システム',
    `action` VARCHAR(50) NOT NULL COMMENT 'アクション種別（generate, verify, dispatch, failed）',
    `ip_address` VARCHAR(45) DEFAULT NULL COMMENT 'IPアドレス',
    `user_agent` TEXT DEFAULT NULL COMMENT 'User-Agent',
    `success` BOOLEAN NOT NULL DEFAULT TRUE COMMENT '成功フラグ',
    `error_message` TEXT DEFAULT NULL COMMENT 'エラーメッセージ',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '実行日時（日本時間）',
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_ticket_id` (`ticket_id`),
    INDEX `idx_source_system` (`source_system`),
    INDEX `idx_target_system` (`target_system`),
    INDEX `idx_action` (`action`),
    INDEX `idx_created_at` (`created_at`),
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`ticket_id`) REFERENCES `sso_tickets`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='SSO監査ログテーブル';

