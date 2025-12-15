-- レッスン複数テキストファイルテーブル作成スクリプト
-- データベース: curriculum-portal

USE `curriculum-portal`;

-- レッスン複数テキストファイルテーブル
CREATE TABLE IF NOT EXISTS lesson_text_files (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ファイルID',
    lesson_id INT NOT NULL COMMENT '関連レッスンID',
    file_name VARCHAR(255) NOT NULL COMMENT 'ファイル名',
    s3_key VARCHAR(1024) NOT NULL COMMENT 'S3オブジェクトキー',
    file_type VARCHAR(50) COMMENT 'ファイルタイプ (pdf, text/plain, text/markdown, application/rtfなど)',
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

