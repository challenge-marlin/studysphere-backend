-- カリキュラムポータル データベース初期化SQL
-- MySQL 8.0対応

-- タイムゾーン設定（日本時間）
-- Docker環境では--default-time-zone=+09:00で設定済みのため、この設定は不要
-- SET time_zone = '+09:00';


CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY 'shinomoto926!';
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'shinomoto926!';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;

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
    `token` VARCHAR(14) DEFAULT NULL COMMENT '管理符号トークン（形式：XXXX-XXXX-XXXX）',
    `token_issued_at` DATETIME DEFAULT NULL COMMENT 'トークン発行日時',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    UNIQUE KEY `unique_company_token` (`token`)
) COMMENT = '企業情報テーブル';

-- 拠点（サテライト）テーブル
CREATE TABLE `satellites` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '拠点ID',
    `company_id` INT NOT NULL COMMENT '所属企業ID',
    `name` VARCHAR(255) NOT NULL COMMENT '拠点名',
    `address` TEXT DEFAULT NULL COMMENT '拠点住所',
    `phone` VARCHAR(20) DEFAULT NULL COMMENT '拠点電話番号',
    `office_type_id` INT DEFAULT NULL COMMENT '事業所タイプID',
    `token` VARCHAR(14) DEFAULT NULL COMMENT '拠点トークン（形式：XXXX-XXXX-XXXX）',
    `contract_type` ENUM('30days', '90days', '1year') DEFAULT '30days' COMMENT '契約タイプ',
    `max_users` INT NOT NULL DEFAULT 10 COMMENT '利用者（ロール1）の上限登録人数',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT 'ステータス（1=稼働中、0=停止中）',
    `manager_ids` JSON DEFAULT NULL COMMENT '管理者（ロール5）のユーザーID配列',
    `disabled_course_ids` JSON DEFAULT NULL COMMENT '無効化されているコースIDの配列（未設定=全コース有効）',
    `token_issued_at` DATETIME NOT NULL COMMENT 'トークン発行日',
    `token_expiry_at` DATETIME NOT NULL COMMENT 'トークン有効期限',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`office_type_id`) REFERENCES `office_types`(`id`) ON DELETE SET NULL,
    INDEX `idx_company_id` (`company_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_manager_ids` ((CAST(`manager_ids` AS CHAR(100)))),
    UNIQUE KEY `unique_satellite_token` (`token`)
) COMMENT = '拠点（サテライト）テーブル';

-- ユーザー情報テーブル
CREATE TABLE `user_accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ユーザーID',
    `name` VARCHAR(255) NOT NULL COMMENT 'ユーザー名（個人名または企業名）',
    `email` VARCHAR(255) DEFAULT NULL COMMENT 'メールアドレス',
    `role` TINYINT NOT NULL COMMENT 'ロール（9=アドミン、5=管理者、4=指導員、1=利用者）',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT 'ステータス（1=稼働中、0=停止中）',
    `login_code` CHAR(14) NOT NULL COMMENT 'ログインコード（形式：XXXX-XXXX-XXXX）',
    `company_id` INT DEFAULT NULL COMMENT '所属企業ID（利用者は必須、管理者以上はNULL可）',
    `satellite_ids` JSON DEFAULT NULL COMMENT '所属拠点ID配列（複数拠点対応）',
    `is_remote_user` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '在宅支援対象（ロール1専用）',
    `recipient_number` VARCHAR(30) DEFAULT NULL COMMENT '受給者証番号',
    `password_reset_required` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'パスワード変更要求フラグ（1=変更要求あり、0=変更要求なし）',
    `instructor_id` INT DEFAULT NULL COMMENT '担当指導員ID（ロール1専用）',
    UNIQUE KEY `unique_login_code` (`login_code`),
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`instructor_id`) REFERENCES `user_accounts`(`id`) ON DELETE SET NULL,
    INDEX `idx_satellite_ids` ((CAST(`satellite_ids` AS CHAR(100)))),
    INDEX `idx_email` (`email`),
    INDEX `idx_password_reset_required` (`password_reset_required`),
    INDEX `idx_instructor_id` (`instructor_id`)
) COMMENT = 'ユーザー情報テーブル';

-- 管理者認証テーブル（ロール4以上専用）
CREATE TABLE `admin_credentials` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '認証ID',
    `user_id` INT NOT NULL COMMENT 'ユーザーID（user_accounts.id）',
    `username` VARCHAR(50) NOT NULL COMMENT 'ログインID（ユーザー名）',
    `password_hash` VARCHAR(255) NOT NULL COMMENT 'パスワードハッシュ（bcrypt等で暗号化）',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    `last_login_at` DATETIME DEFAULT NULL COMMENT '最終ログイン日時',
    UNIQUE KEY `unique_user_id` (`user_id`),
    UNIQUE KEY `unique_username` (`username`),
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE
) COMMENT = '管理者認証テーブル（ロール4以上専用）';

-- 利用者一時パスワード管理テーブル（ロール1専用）
CREATE TABLE `user_temp_passwords` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '一時パスワードID',
    `user_id` INT NOT NULL COMMENT 'ユーザーID（user_accounts.id）',
    `temp_password` VARCHAR(10) NOT NULL COMMENT '一時パスワード（XXXX-XXXX形式）',
    `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '発行日時',
    `expires_at` DATETIME NOT NULL COMMENT '有効期限（日本時間23:59）',
    `is_used` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '使用済みフラグ（1=使用済み、0=未使用）',
    `used_at` DATETIME DEFAULT NULL COMMENT '使用日時',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_expires_at` (`expires_at`),
    INDEX `idx_is_used` (`is_used`)
) COMMENT = '利用者一時パスワード管理テーブル（ロール1専用）';

-- 一時パスワードの自動揮発用イベントスケジューラー
-- 毎日午前0時10分（日本時間）に期限切れの一時パスワードを削除
-- UTC時間では前日15時10分に実行（日本時間午前0時10分 = UTC前日15時10分）
CREATE EVENT IF NOT EXISTS `cleanup_expired_temp_passwords`
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURDATE() + INTERVAL 15 HOUR + INTERVAL 10 MINUTE)
DO
    DELETE FROM `user_temp_passwords` 
    WHERE `expires_at` < CONVERT_TZ(NOW(), '+00:00', '+09:00') 
    AND `is_used` = 0;

-- 個人メッセージの自動揮発用イベントスケジューラー
-- 毎日午前0時30分（日本時間）に期限切れの個人メッセージを削除
-- UTC時間では前日15時30分に実行（日本時間午前0時30分 = UTC前日15時30分）
CREATE EVENT IF NOT EXISTS `cleanup_expired_personal_messages`
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURDATE() + INTERVAL 15 HOUR + INTERVAL 30 MINUTE)
DO
    DELETE FROM `personal_messages` 
    WHERE `expires_at` < CONVERT_TZ(NOW(), '+00:00', '+09:00');

-- アナウンスメッセージの自動揮発用イベントスケジューラー
-- 毎日午前0時30分（日本時間）に期限切れのアナウンスメッセージを削除
-- UTC時間では前日15時30分に実行（日本時間午前0時30分 = UTC前日15時30分）
CREATE EVENT IF NOT EXISTS `cleanup_expired_announcements`
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURDATE() + INTERVAL 15 HOUR + INTERVAL 30 MINUTE)
DO
    DELETE FROM `announcements` 
    WHERE `expires_at` < CONVERT_TZ(NOW(), '+00:00', '+09:00');

-- イベントスケジューラーを有効化
SET GLOBAL event_scheduler = ON;

CREATE TABLE `user_tags` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'タグID',
    `user_id` INT NOT NULL COMMENT 'ユーザーID（user_accounts.id）',
    `tag_name` VARCHAR(100) NOT NULL COMMENT 'タグ名',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_user_tag` (`user_id`, `tag_name`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_tag_name` (`tag_name`)
) COMMENT = 'ユーザータグ情報管理テーブル';

-- コース管理テーブル
CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL COMMENT 'コース名',
    description TEXT COMMENT 'コースの説明',
    category VARCHAR(100) NOT NULL DEFAULT '選択科目' COMMENT 'カテゴリ（必修科目/選択科目）',
    status ENUM('active', 'inactive', 'draft') DEFAULT 'active' COMMENT 'コースの状態',
    order_index INT DEFAULT 0 COMMENT '表示順序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT COMMENT '作成者ID',
    updated_by INT COMMENT '更新者ID',
    INDEX idx_status (status),
    INDEX idx_category (category),
    INDEX idx_order (order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='コース管理テーブル';

-- レッスン管理テーブル
CREATE TABLE IF NOT EXISTS lessons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL COMMENT '関連コースID',
    title VARCHAR(255) NOT NULL COMMENT 'レッスン名',
    description TEXT COMMENT 'レッスン説明',
    duration VARCHAR(50) COMMENT '所要時間',
    order_index INT NOT NULL DEFAULT 0 COMMENT '表示順序',
    has_assignment BOOLEAN NOT NULL DEFAULT FALSE COMMENT '課題の有無',
    s3_key VARCHAR(1024) COMMENT 'S3オブジェクトキー',
    file_type VARCHAR(50) COMMENT 'ファイルタイプ (pdf, md, docx, pptxなど)',
    file_size BIGINT COMMENT 'ファイルサイズ (バイト)',
    status ENUM('active', 'inactive', 'draft', 'deleted') NOT NULL DEFAULT 'active' COMMENT 'ステータス',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT COMMENT '作成者ID',
    updated_by INT COMMENT '更新者ID',
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='レッスン管理テーブル';

CREATE TABLE `user_lesson_progress` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '進捗ID',
  `user_id` INT NOT NULL COMMENT '利用者ID',
  `lesson_id` INT NOT NULL COMMENT 'レッスンID',
  `status` ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'not_started' COMMENT '進捗状況',
  `completed_at` DATETIME DEFAULT NULL COMMENT '完了日時',
  `test_score` INT DEFAULT NULL COMMENT 'テストスコア',
  `assignment_submitted` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '課題提出済みフラグ',
  `assignment_submitted_at` DATETIME DEFAULT NULL COMMENT '課題提出日時',
  `instructor_approved` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '指導員承認フラグ',
  `instructor_approved_at` DATETIME DEFAULT NULL COMMENT '指導員承認日時',
  `instructor_id` INT DEFAULT NULL COMMENT '承認した指導員ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  UNIQUE KEY `unique_user_lesson` (`user_id`, `lesson_id`),
  FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`instructor_id`) REFERENCES `user_accounts`(`id`) ON DELETE SET NULL,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_lesson_id` (`lesson_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_completed_at` (`completed_at`),
  INDEX `idx_instructor_approved` (`instructor_approved`)
) COMMENT = '利用者のレッスン進捗管理テーブル';

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
    `instructor_comment` JSON DEFAULT NULL COMMENT '指導員コメント（JSON形式）',
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
    `lesson_id` INT NOT NULL COMMENT 'レッスンID',
    `curriculum_name` VARCHAR(100) NOT NULL COMMENT 'カリキュラム名（例：カリキュラム1）',
    `session_number` INT NOT NULL COMMENT '第◯回（数値）',
    `file_url` TEXT NOT NULL COMMENT 'S3ファイルパス（署名なし相対URL）',
    `file_type` ENUM('image', 'pdf', 'other') DEFAULT 'other' COMMENT 'ファイルタイプ',
    `file_name` VARCHAR(255) NOT NULL COMMENT '元のファイル名',
    `file_size` BIGINT NOT NULL COMMENT 'ファイルサイズ（バイト）',
    `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'アップロード日時',
    `instructor_approved` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '指導員承認フラグ',
    `instructor_approved_at` DATETIME DEFAULT NULL COMMENT '指導員承認日時',
    `instructor_id` INT DEFAULT NULL COMMENT '承認した指導員ID',
    `instructor_comment` TEXT DEFAULT NULL COMMENT '指導員コメント',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`instructor_id`) REFERENCES `user_accounts`(`id`) ON DELETE SET NULL,
    INDEX (`user_id`, `curriculum_name`, `session_number`),
    INDEX `idx_lesson_id` (`lesson_id`),
    INDEX `idx_instructor_approved` (`instructor_approved`),
    INDEX `idx_uploaded_at` (`uploaded_at`)
) COMMENT = 'カリキュラム成果物ファイル情報';

-- 指導者専門分野テーブル
CREATE TABLE `instructor_specializations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '専門分野ID',
    `user_id` INT NOT NULL COMMENT '指導者のユーザーID（user_accounts.id）',
    `specialization` VARCHAR(255) NOT NULL COMMENT '専門分野（テキスト形式）',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    INDEX `idx_user_id` (`user_id`)
) COMMENT = '指導者専門分野テーブル';

-- レッスン動画テーブル（1対多対応）
CREATE TABLE IF NOT EXISTS lesson_videos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lesson_id INT NOT NULL COMMENT '関連レッスンID',
    title VARCHAR(255) NOT NULL COMMENT '動画タイトル',
    description TEXT COMMENT '動画説明',
    youtube_url VARCHAR(500) NOT NULL COMMENT 'YouTube動画URL',
    order_index INT NOT NULL DEFAULT 0 COMMENT '表示順序',
    duration VARCHAR(50) COMMENT '動画の長さ',
    thumbnail_url VARCHAR(500) COMMENT 'サムネイル画像URL',
    status ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active' COMMENT 'ステータス',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT COMMENT '作成者ID',
    updated_by INT COMMENT '更新者ID',
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    INDEX idx_lesson_id (lesson_id),
    INDEX idx_order (order_index),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='レッスン動画テーブル（1対多対応）';

-- レッスンテキストと動画の紐づけテーブル
CREATE TABLE IF NOT EXISTS lesson_text_video_links (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '紐づけID',
    lesson_id INT NOT NULL COMMENT '関連レッスンID',
    text_file_key VARCHAR(255) NOT NULL COMMENT 'テキストファイルのS3キー',
    video_id INT NOT NULL COMMENT '関連動画ID',
    link_order INT NOT NULL DEFAULT 0 COMMENT '紐づけ順序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    created_by INT COMMENT '作成者ID',
    updated_by INT COMMENT '更新者ID',
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES lesson_videos(id) ON DELETE CASCADE,
    UNIQUE KEY unique_text_video_link (lesson_id, text_file_key, video_id),
    INDEX idx_lesson_id (lesson_id),
    INDEX idx_video_id (video_id),
    INDEX idx_link_order (link_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='レッスンテキストと動画の紐づけテーブル';

-- レッスン複数テキストファイルテーブル
CREATE TABLE IF NOT EXISTS lesson_text_files (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ファイルID',
    lesson_id INT NOT NULL COMMENT '関連レッスンID',
    file_name VARCHAR(255) NOT NULL COMMENT 'ファイル名',
    s3_key VARCHAR(1024) NOT NULL COMMENT 'S3オブジェクトキー',
    file_type VARCHAR(50) COMMENT 'ファイルタイプ (pdf, txt, md, docx, pptxなど)',
    file_size BIGINT COMMENT 'ファイルサイズ (バイト)',
    order_index INT NOT NULL DEFAULT 0 COMMENT '表示順序',
    status ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active' COMMENT 'ステータス',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    created_by INT COMMENT '作成者ID',
    updated_by INT COMMENT '更新者ID',
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    INDEX idx_lesson_id (lesson_id),
    INDEX idx_order_index (order_index),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='レッスン複数テキストファイルテーブル';

-- カリキュラムパステーブル
CREATE TABLE IF NOT EXISTS curriculum_paths (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'カリキュラムパスID',
    name VARCHAR(255) NOT NULL COMMENT 'パス名',
    description TEXT COMMENT 'パス説明',
    target_audience VARCHAR(255) COMMENT '対象者',
    duration VARCHAR(100) COMMENT '期間（例：12ヶ月）',
    status ENUM('active', 'inactive', 'draft') DEFAULT 'draft' COMMENT 'ステータス',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    created_by INT COMMENT '作成者ID',
    updated_by INT COMMENT '更新者ID',
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='カリキュラムパステーブル';

-- カリキュラムパス-コース関連テーブル
CREATE TABLE IF NOT EXISTS curriculum_path_courses (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '関連ID',
    curriculum_path_id INT NOT NULL COMMENT 'カリキュラムパスID',
    course_id INT NOT NULL COMMENT 'コースID',
    order_index INT NOT NULL DEFAULT 0 COMMENT '表示順序',
    is_required BOOLEAN NOT NULL DEFAULT TRUE COMMENT '必須コースかどうか',
    estimated_duration VARCHAR(100) COMMENT '推定期間（例：3ヶ月）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    FOREIGN KEY (curriculum_path_id) REFERENCES curriculum_paths(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_path_course (curriculum_path_id, course_id),
    INDEX idx_path_id (curriculum_path_id),
    INDEX idx_course_id (course_id),
    INDEX idx_order (order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='カリキュラムパス-コース関連テーブル';

-- 操作ログテーブル
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '操作ログID',
  `admin_id` INT COMMENT '管理者ID',
  `admin_name` VARCHAR(100) COMMENT '管理者名',
  `action` VARCHAR(100) NOT NULL COMMENT '操作内容',
  `details` TEXT COMMENT '詳細',
  `ip_address` VARCHAR(45) COMMENT 'IPアドレス',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  INDEX `idx_admin_id` (`admin_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作ログテーブル';

-- 利用者とコースの関連付けテーブル
CREATE TABLE IF NOT EXISTS `user_courses` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '関連付けID',
    `user_id` INT NOT NULL COMMENT '利用者ID',
    `course_id` INT NOT NULL COMMENT 'コースID',
    `curriculum_path_id` INT DEFAULT NULL COMMENT 'カリキュラムパスID（カリキュラムパス経由で追加された場合）',
    `assigned_by` INT DEFAULT NULL COMMENT '割り当て担当者ID',
    `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '割り当て日時',
    `status` ENUM('active', 'completed', 'paused', 'cancelled') DEFAULT 'active' COMMENT '学習ステータス',
    `start_date` DATE DEFAULT NULL COMMENT '学習開始日',
    `completion_date` DATE DEFAULT NULL COMMENT '完了日',
    `progress_percentage` DECIMAL(5,2) DEFAULT 0.00 COMMENT '進捗率（%）',
    `notes` TEXT DEFAULT NULL COMMENT '備考',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`curriculum_path_id`) REFERENCES `curriculum_paths`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`assigned_by`) REFERENCES `user_accounts`(`id`) ON DELETE SET NULL,
    UNIQUE KEY `unique_user_course` (`user_id`, `course_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_course_id` (`course_id`),
    INDEX `idx_curriculum_path_id` (`curriculum_path_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_assigned_at` (`assigned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='利用者とコースの関連付けテーブル';

-- 利用者とカリキュラムパスの関連付けテーブル
CREATE TABLE IF NOT EXISTS `user_curriculum_paths` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '関連付けID',
    `user_id` INT NOT NULL COMMENT '利用者ID',
    `curriculum_path_id` INT NOT NULL COMMENT 'カリキュラムパスID',
    `assigned_by` INT DEFAULT NULL COMMENT '割り当て担当者ID',
    `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '割り当て日時',
    `status` ENUM('active', 'completed', 'paused', 'cancelled') DEFAULT 'active' COMMENT '学習ステータス',
    `start_date` DATE DEFAULT NULL COMMENT '学習開始日',
    `completion_date` DATE DEFAULT NULL COMMENT '完了日',
    `progress_percentage` DECIMAL(5,2) DEFAULT 0.00 COMMENT '進捗率（%）',
    `notes` TEXT DEFAULT NULL COMMENT '備考',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`curriculum_path_id`) REFERENCES `curriculum_paths`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`assigned_by`) REFERENCES `user_accounts`(`id`) ON DELETE SET NULL,
    UNIQUE KEY `unique_user_curriculum_path` (`user_id`, `curriculum_path_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_curriculum_path_id` (`curriculum_path_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_assigned_at` (`assigned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='利用者とカリキュラムパスの関連付けテーブル';

-- アナウンスメッセージテーブル
CREATE TABLE IF NOT EXISTS `announcements` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'アナウンスID',
    `title` VARCHAR(255) NOT NULL COMMENT 'アナウンスタイトル',
    `message` TEXT NOT NULL COMMENT 'アナウンスメッセージ',
    `created_by` INT NOT NULL COMMENT '作成者ID',
    `expires_at` DATETIME NOT NULL DEFAULT (DATE_ADD(CURDATE(), INTERVAL 1 DAY) + INTERVAL 30 MINUTE) COMMENT '有効期限（日本時間24:30）',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    FOREIGN KEY (`created_by`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    INDEX `idx_created_by` (`created_by`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='アナウンスメッセージテーブル';

-- 利用者アナウンス関連付けテーブル
CREATE TABLE IF NOT EXISTS `user_announcements` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '関連付けID',
    `user_id` INT NOT NULL COMMENT '利用者ID',
    `announcement_id` INT NOT NULL COMMENT 'アナウンスID',
    `is_read` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '既読フラグ',
    `read_at` TIMESTAMP NULL DEFAULT NULL COMMENT '既読日時',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_user_announcement` (`user_id`, `announcement_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_announcement_id` (`announcement_id`),
    INDEX `idx_is_read` (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='利用者アナウンス関連付けテーブル';

-- 個人メッセージテーブル
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

-- 管理者ユーザーの作成
INSERT INTO user_accounts (id, name, role, status, login_code) VALUES 
(1, 'マスターユーザ', 10, 1, 'ADMN-0001-0001')
ON DUPLICATE KEY UPDATE name = name;

-- 管理者認証情報の作成（パスワード: admin123）
INSERT INTO admin_credentials (user_id, username, password_hash) VALUES 
(1, 'admin001', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O')
ON DUPLICATE KEY UPDATE username = username;