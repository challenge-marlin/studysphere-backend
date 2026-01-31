-- user_lesson_progress に「最後に閲覧したセクションのテキストキー（S3キー）」を追加
-- セクション一覧は lesson_text_video_links / lesson_text_files を結合・ソートして作られるため、
-- index（配列位置）だけでは順序変化で復帰先がズレる。安定キーとして text_file_key を保存する。
ALTER TABLE user_lesson_progress
  ADD COLUMN last_viewed_section_text_key VARCHAR(1024) NULL DEFAULT NULL
  COMMENT '最後に閲覧したセクションのテキストS3キー（完全パス）'
  AFTER last_viewed_section_index;

-- MySQL(InnoDB) の index key length 制限(3072 bytes)対策:
-- utf8mb4 の場合 1文字最大4bytesなので、VARCHAR(1024) 全体を索引化すると超過する。
-- 先頭191文字のプレフィックスインデックスにする（191*4=764bytes）。
CREATE INDEX idx_last_viewed_section_text_key
  ON user_lesson_progress (last_viewed_section_text_key(191));

