
-- user_lesson_progress に「最後に閲覧したセクション番号（0始まり）」を追加
ALTER TABLE user_lesson_progress
  ADD COLUMN last_viewed_section_index INT NULL DEFAULT NULL COMMENT '最後に閲覧したセクションインデックス（0始まり）' AFTER last_accessed_at;

CREATE INDEX idx_last_viewed_section_index ON user_lesson_progress (last_viewed_section_index);
