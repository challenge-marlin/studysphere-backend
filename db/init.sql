-- カリキュラムポータル データベース初期化SQL
-- MySQL 8.0対応

-- データベースの作成（存在しない場合）
CREATE DATABASE IF NOT EXISTS `curriculum-portal` 
CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

USE `curriculum-portal`;

-- 事業所タイプテーブル
CREATE TABLE `office_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '事業所タイプID',
    `type` VARCHAR(100) NOT NULL COMMENT '事業所タイプ名',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    UNIQUE KEY `unique_type` (`type`)
) COMMENT = '事業所タイプテーブル';

-- 企業情報テーブル
CREATE TABLE `companies` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '企業ID',
    `name` VARCHAR(255) NOT NULL COMMENT '企業名（管理者以上のユーザ名として使用）',
    `address` TEXT DEFAULT NULL COMMENT '企業住所',
    `phone` VARCHAR(20) DEFAULT NULL COMMENT '企業電話番号',
    `office_type_id` INT DEFAULT NULL COMMENT '事業所タイプID',
    `token_issued_at` DATETIME NOT NULL COMMENT 'トークン発行日',
    `token_expiry_at` DATETIME NOT NULL COMMENT 'トークン有効期限',
    `max_users` INT NOT NULL DEFAULT 5 COMMENT 'ロール1の上限登録人数',
    FOREIGN KEY (`office_type_id`) REFERENCES `office_types`(`id`) ON DELETE SET NULL
) COMMENT = '企業情報テーブル';

-- 拠点（サテライト）テーブル
CREATE TABLE `satellites` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '拠点ID',
    `company_id` INT NOT NULL COMMENT '所属企業ID',
    `name` VARCHAR(255) NOT NULL COMMENT '拠点名',
    `address` TEXT NOT NULL COMMENT '拠点住所',
    `max_users` INT NOT NULL DEFAULT 10 COMMENT '利用者（ロール1）の上限登録人数',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT 'ステータス（1=稼働中、0=停止中）',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE,
    INDEX `idx_company_id` (`company_id`),
    INDEX `idx_status` (`status`)
) COMMENT = '拠点（サテライト）テーブル';

-- ユーザー情報テーブル
CREATE TABLE `user_accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ユーザーID',
    `name` VARCHAR(255) NOT NULL COMMENT 'ユーザー名（個人名または企業名）',
    `role` TINYINT NOT NULL COMMENT 'ロール（9=アドミン、5=管理者、1=利用者）',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT 'ステータス（1=稼働中、0=停止中）',
    `login_code` CHAR(14) NOT NULL COMMENT 'ログインコード（形式：XXXX-XXXX-XXXX）',
    `company_id` INT DEFAULT NULL COMMENT '所属企業ID（利用者は必須、管理者以上はNULL可）',
    `satellite_id` INT DEFAULT NULL COMMENT '所属拠点ID（利用者専用、拠点所属の場合）',
    `is_remote_user` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '在宅支援対象（ロール1専用）',
    `recipient_number` VARCHAR(30) DEFAULT NULL COMMENT '受給者証番号',
    UNIQUE KEY `unique_login_code` (`login_code`),
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`satellite_id`) REFERENCES `satellites`(`id`) ON DELETE SET NULL
) COMMENT = 'ユーザー情報テーブル';

-- 管理者認証テーブル（ロール5以上専用）
CREATE TABLE `admin_credentials` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '認証ID',
    `user_id` INT NOT NULL COMMENT 'ユーザーID（user_accounts.id）',
    `username` VARCHAR(50) NOT NULL COMMENT 'ログインID（ユーザー名）',
    `password_hash` VARCHAR(255) NOT NULL COMMENT 'パスワードハッシュ（bcrypt等で暗号化）',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    `last_login_at` DATETIME DEFAULT NULL COMMENT '最終ログイン日時',
    UNIQUE KEY `unique_username` (`username`),
    UNIQUE KEY `unique_user_id` (`user_id`),
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    INDEX `idx_username` (`username`)
) COMMENT = '管理者認証テーブル（ロール5以上専用）';

-- カリキュラム進行状況テーブル
CREATE TABLE `curriculum_progress` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '進行記録ID',
    `user_id` INT NOT NULL COMMENT '利用者のユーザーID',
    `curriculum_name` VARCHAR(100) NOT NULL COMMENT 'カリキュラム名（例：カリキュラム1）',
    `session_number` INT NOT NULL COMMENT '第◯回（例：第1回）',
    `chapter_number` INT NOT NULL COMMENT '第◯章（例：第1章）',
    `deliverable_confirmed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '成果物確認済みフラグ',
    `test_passed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'テスト合格フラグ',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最終更新日時',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_progress` (`user_id`, `curriculum_name`, `session_number`, `chapter_number`)
) COMMENT = 'カリキュラム進行状況テーブル';

-- リフレッシュトークン管理テーブル
CREATE TABLE `refresh_tokens` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'リフレッシュトークンID',
    `user_id` INT NOT NULL COMMENT 'ユーザーID',
    `token` VARCHAR(512) NOT NULL COMMENT 'リフレッシュトークン（JWT文字列）',
    `issued_at` DATETIME NOT NULL COMMENT '発行日時',
    `expires_at` DATETIME NOT NULL COMMENT '有効期限（日本時間23:59対応）',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_refresh_token` (`token`)
) COMMENT = 'リフレッシュトークン管理テーブル';

-- カリキュラム動画テーブル
CREATE TABLE `curriculum_videos` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `curriculum_name` VARCHAR(100) NOT NULL COMMENT 'カリキュラム名（S3のフォルダ名）',
    `session_number` INT NOT NULL COMMENT '回数（S3の「第◯回」フォルダ）',
    `youtube_url` VARCHAR(255) NOT NULL COMMENT 'YouTube URL',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_curriculum` (`curriculum_name`, `session_number`)
);

-- テスト結果テーブル
CREATE TABLE `test_results` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `type` ENUM('calling', 'GATB', 'personal', 'consultant') NOT NULL,
    `result_url` TEXT NOT NULL,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`)
);

-- パーソナリティ診断結果テーブル
CREATE TABLE `personality_results` (
    `user_id` INT PRIMARY KEY COMMENT 'ユーザーID（user_accounts.id）',
    `company_id` INT,
    `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `conscientiousness` FLOAT,
    `agreeableness` FLOAT,
    `emotional_stability` FLOAT,
    `extraversion` FLOAT,
    `openness` FLOAT,
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    INDEX(`company_id`)
);

-- 職業興味診断結果テーブル
CREATE TABLE `questionnaire_results` (
    `user_id` INT PRIMARY KEY COMMENT 'ユーザーID（user_accounts.id）',
    `company_id` INT COMMENT '所属企業ID',
    `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    `realistic` FLOAT COMMENT '現実的（R）',
    `investigative` FLOAT COMMENT '研究的（I）',
    `artistic` FLOAT COMMENT '芸術的（A）',
    `social` FLOAT COMMENT '社会的（S）',
    `enterprising` FLOAT COMMENT '企業的（E）',
    `conventional` FLOAT COMMENT '慣習的（C）',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    INDEX(`company_id`)
) COMMENT = '職業興味診断結果（RIASECタイプ／最新値のみ）';

-- GATB診断スコアテーブル
CREATE TABLE `gatb_results` (
    `user_id` INT PRIMARY KEY COMMENT 'ユーザーID（user_accounts.id）',
    `score_g` INT NOT NULL COMMENT 'G：知的能力スコア',
    `score_v` INT NOT NULL COMMENT 'V：言語能力スコア',
    `score_n` INT NOT NULL COMMENT 'N：数理能力スコア',
    `score_q` INT NOT NULL COMMENT 'Q：書記的知覚スコア',
    `score_s` INT NOT NULL COMMENT 'S：空間判断力スコア',
    `score_p` INT NOT NULL COMMENT 'P：形態知覚スコア',
    `grade` ENUM('中学生', '高校生', '大学生', 'その他') NOT NULL COMMENT '学年区分',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE
) COMMENT = 'GATB診断スコアテーブル（最新値のみ）';

-- カリキュラム進行ルートテーブル
CREATE TABLE `curriculum_routes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `from_curriculum` VARCHAR(100) NOT NULL COMMENT '現在のカリキュラム名（例：カリキュラム3）',
    `from_session` INT NOT NULL COMMENT '現在の回数（例：12）',
    `to_curriculum` VARCHAR(100) NOT NULL COMMENT '次に進むカリキュラム名',
    `is_optional` BOOLEAN DEFAULT FALSE COMMENT '選択制かどうか',
    `condition_json` TEXT COMMENT '進行条件（JSON形式で将来拡張可能）',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) COMMENT = 'カリキュラム進行ルート（通常→自動、選択制→複数行）';

-- 在宅支援の日次記録テーブル
CREATE TABLE `remote_support_daily_records` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '記録ID',
    `user_id` INT NOT NULL COMMENT '利用者のユーザーID',
    `date` DATE NOT NULL COMMENT '実施日',
    `mark_start` DATETIME DEFAULT NULL COMMENT '始業打刻',
    `mark_lunch_start` DATETIME DEFAULT NULL COMMENT '昼休憩開始打刻',
    `mark_lunch_end` DATETIME DEFAULT NULL COMMENT '昼休憩終了打刻',
    `mark_end` DATETIME DEFAULT NULL COMMENT '終業打刻',
    `temperature` VARCHAR(10) DEFAULT NULL COMMENT '体温（任意）',
    `condition` VARCHAR(10) NOT NULL COMMENT '体調（良い・普通・悪い）',
    `condition_note` TEXT DEFAULT NULL COMMENT '体調備考（任意）',
    `work_note` TEXT NOT NULL COMMENT '本日の作業内容（必須）',
    `work_result` TEXT COMMENT '作業内容実績',
    `daily_report` TEXT COMMENT '日報',
    `support_method` ENUM('訪問', '電話', 'その他') DEFAULT NULL COMMENT '支援方法',
    `support_method_note` VARCHAR(255) DEFAULT NULL COMMENT '支援方法補足（その他）',
    `task_content` TEXT COMMENT '作業・訓練内容',
    `support_content` TEXT COMMENT '支援内容（1日2回以上）',
    `advice` TEXT COMMENT '対象者の心身の状況・助言内容',
    `recorder_name` VARCHAR(100) COMMENT '記録者名',
    `webcam_photos` JSON DEFAULT NULL COMMENT 'Webカメラ画像URL一覧（S3）',
    `screenshots` JSON DEFAULT NULL COMMENT 'スクリーンショットURL一覧（S3）',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_daily_record` (`user_id`, `date`)
) COMMENT = '在宅支援の日次記録（打刻含む）';

-- 週報（評価）記録テーブル
CREATE TABLE `weekly_evaluation_records` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '週報記録ID',
    `user_id` INT NOT NULL COMMENT '利用者のユーザーID',
    `date` DATE NOT NULL COMMENT '評価実施日（評価記入日）',
    `prev_eval_date` DATE DEFAULT NULL COMMENT '前回評価日（任意）',
    `period_start` DATE NOT NULL COMMENT '対象期間の開始日',
    `period_end` DATE NOT NULL COMMENT '対象期間の終了日',
    `evaluation_method` ENUM('通所', '訪問', 'その他') NOT NULL DEFAULT '通所' COMMENT '評価方法',
    `method_other` VARCHAR(255) DEFAULT NULL COMMENT '評価方法の補足（その他）',
    `evaluation_content` TEXT COMMENT '評価内容（1週間分の状況まとめ）',
    `recorder_name` VARCHAR(100) COMMENT '記録者名',
    `confirm_name` VARCHAR(100) COMMENT '確認者名（サービス管理責任者）',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE
) COMMENT = '週報（評価）記録テーブル';

-- 月次評価記録テーブル
CREATE TABLE `monthly_evaluation_records` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '評価ID',
    `user_id` INT NOT NULL COMMENT '利用者のユーザーID',
    `date` DATE NOT NULL COMMENT '評価実施日（実施日）',
    `mark_start` DATETIME DEFAULT NULL COMMENT '始業時間（任意）',
    `mark_end` DATETIME DEFAULT NULL COMMENT '終業時間（任意）',
    `evaluation_method` ENUM('通所', '訪問', 'その他') NOT NULL DEFAULT '通所' COMMENT '評価方法',
    `method_other` VARCHAR(255) DEFAULT NULL COMMENT '評価方法の補足（その他）',
    `goal` TEXT COMMENT '訓練目標',
    `effort` TEXT COMMENT '取組内容',
    `achievement` TEXT COMMENT '訓練目標に対する達成度',
    `issues` TEXT COMMENT '課題',
    `improvement` TEXT COMMENT '課題の改善方針',
    `health` TEXT COMMENT '健康・体調面での留意事項',
    `others` TEXT COMMENT 'その他特記事項',
    `appropriateness` TEXT COMMENT '在宅就労継続の妥当性',
    `evaluator_name` VARCHAR(100) COMMENT '評価実施者氏名',
    `prev_evaluation_date` DATE DEFAULT NULL COMMENT '前回の達成度評価日',
    `recipient_number` VARCHAR(30) DEFAULT NULL COMMENT '受給者証番号（表示用）',
    `user_name` VARCHAR(100) DEFAULT NULL COMMENT '対象者名（表示用）',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_monthly_eval` (`user_id`, `date`)
) COMMENT = '月次評価記録（様式3対応）';

-- 個別支援計画テーブル
CREATE TABLE `support_plans` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `long_term_goal` TEXT,
    `short_term_goal` TEXT,
    `needs` TEXT,
    `support_content` TEXT,
    `goal_date` DATE,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`)
) COMMENT = '個別支援計画';

-- カリキュラム成果物ファイル情報テーブル
CREATE TABLE `deliverables` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '成果物ID',
    `user_id` INT NOT NULL COMMENT 'ユーザーID',
    `curriculum_name` VARCHAR(100) NOT NULL COMMENT 'カリキュラム名（例：カリキュラム1）',
    `session_number` INT NOT NULL COMMENT '第◯回（数値）',
    `file_url` TEXT NOT NULL COMMENT 'S3ファイルパス（署名なし相対URL）',
    `file_type` ENUM('image', 'pdf', 'other') DEFAULT 'other' COMMENT 'ファイルタイプ',
    `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'アップロード日時',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    INDEX (`user_id`, `curriculum_name`, `session_number`)
) COMMENT = 'カリキュラム成果物ファイル情報';

-- サンプルデータの挿入

-- 事業所タイプのサンプル
INSERT INTO `office_types` (`id`, `type`) VALUES
(1, '就労移行支援事務所'),
(2, '就労継続支援A型事務所'),
(3, '就労継続支援B型事務所'),
(4, '生活介護事務所'),
(5, '自立訓練事務所'),
(6, '就労定着支援事務所'),
(7, '地域活動支援センター'),
(8, '福祉ホーム'),
(9, 'その他');

-- 企業情報のサンプル
INSERT INTO `companies` (`name`, `token_issued_at`, `token_expiry_at`, `max_users`) VALUES
('アドミニストレータ', NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), 100),
('スタディスフィア株式会社', NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), 50),
('テックサポート株式会社', NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), 30);

-- 拠点情報のサンプル
INSERT INTO `satellites` (`company_id`, `name`, `address`, `max_users`, `status`) VALUES
(2, '東京本校', '東京都渋谷区渋谷1-1-1 スタディスフィアビル1F', 20, 1),
(2, '大阪支校', '大阪府大阪市北区梅田1-1-1 梅田ビジネスセンター2F', 15, 1),
(2, '名古屋支校', '愛知県名古屋市中区栄1-1-1 栄ビジネスパーク3F', 10, 1),
(3, 'テックサポート東京オフィス', '東京都新宿区新宿1-1-1 新宿スカイタワー5F', 15, 1),
(3, 'テックサポート大阪オフィス', '大阪府大阪市中央区本町1-1-1 本町ビジネスセンター4F', 10, 1);

-- ユーザーアカウントのサンプル（管理者）
INSERT INTO `user_accounts` (`name`, `role`, `status`, `login_code`, `company_id`) VALUES
('アドミン', 9, 1, 'ADMN-0001-0001', 1),
('佐藤指導員', 5, 1, 'INSTR-0001-0001', 2),
('田中指導員', 5, 1, 'INSTR-0001-0002', 2),
('山田指導員', 5, 1, 'INSTR-0002-0001', 3);

-- 管理者認証情報のサンプル
INSERT INTO `admin_credentials` (`user_id`, `username`, `password_hash`) VALUES
(1, 'admin001', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.gS8O.m'), -- admin123
(2, 'instructor001', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.gS8O.m'), -- instructor123
(3, 'instructor002', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.gS8O.m'), -- instructor123
(4, 'instructor003', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.gS8O.m'); -- instructor123
