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
    youtube_url VARCHAR(500) COMMENT 'YouTube動画URL',
    status ENUM('active', 'inactive', 'draft', 'deleted') NOT NULL DEFAULT 'active' COMMENT 'ステータス',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT COMMENT '作成者ID',
    updated_by INT COMMENT '更新者ID',
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='レッスン管理テーブル';

-- レッスン進捗管理テーブル（学生の学習進捗を記録）
CREATE TABLE IF NOT EXISTS lesson_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'ユーザーID',
    lesson_id INT NOT NULL COMMENT 'レッスンID',
    status ENUM('not-started', 'in-progress', 'completed') DEFAULT 'not-started' COMMENT '進捗状況',
    test_score INT COMMENT 'テストスコア',
    started_at TIMESTAMP NULL COMMENT '学習開始日時',
    completed_at TIMESTAMP NULL COMMENT '完了日時',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_lesson (user_id, lesson_id),
    INDEX idx_user_id (user_id),
    INDEX idx_lesson_id (lesson_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='レッスン進捗管理テーブル';

 