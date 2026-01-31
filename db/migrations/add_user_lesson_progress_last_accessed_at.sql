-- user_lesson_progress に「最終アクセス日時」を追加（現在受講中判定の精度向上）
ALTER TABLE user_lesson_progress
  ADD COLUMN last_accessed_at DATETIME(3) NULL DEFAULT NULL COMMENT '最終アクセス日時（現在受講中判定用）' AFTER updated_at;

CREATE INDEX idx_last_accessed_at ON user_lesson_progress (last_accessed_at);

-- 既存データの初期値: updated_at をコピー（NULLのままより判定が安定する）
UPDATE user_lesson_progress
SET last_accessed_at = updated_at
WHERE last_accessed_at IS NULL AND updated_at IS NOT NULL;

