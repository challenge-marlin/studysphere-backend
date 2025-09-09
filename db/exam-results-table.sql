-- 試験結果テーブル（exam_results）
-- テストの採点結果を保存するテーブル

CREATE TABLE IF NOT EXISTS `exam_results` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '試験結果ID',
    `user_id` INT NOT NULL COMMENT '利用者ID',
    `lesson_id` INT NOT NULL COMMENT 'レッスンID',
    `test_type` ENUM('section', 'lesson') NOT NULL COMMENT 'テスト種別（セクションテスト/総合テスト）',
    `section_index` INT DEFAULT NULL COMMENT 'セクション番号（セクションテストの場合）',
    `lesson_name` VARCHAR(255) NOT NULL COMMENT 'レッスン名',
    `s3_key` VARCHAR(1024) NOT NULL COMMENT 'S3キー（MD形式の結果ファイル）',
    `passed` BOOLEAN NOT NULL COMMENT '試験合否',
    `score` INT NOT NULL COMMENT '得点',
    `total_questions` INT NOT NULL COMMENT '総問題数',
    `percentage` DECIMAL(5,2) NOT NULL COMMENT '正答率（%）',
    `exam_date` DATETIME NOT NULL COMMENT '受験日時（日本時間）',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE CASCADE,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_lesson_id` (`lesson_id`),
    INDEX `idx_test_type` (`test_type`),
    INDEX `idx_exam_date` (`exam_date`),
    INDEX `idx_passed` (`passed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='試験結果テーブル';
