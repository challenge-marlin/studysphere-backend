-- gatb_resultsテーブルのgradeカラムに「その他」を追加するマイグレーション
-- 既存のテーブル定義を確認してから実行してください

-- 現在のENUM定義を確認（実行前に確認用）
-- SHOW COLUMNS FROM `gatb_results` LIKE 'grade';

-- ENUMに「その他」を追加（既に存在する場合はエラーになりますが、問題ありません）
ALTER TABLE `gatb_results` 
MODIFY COLUMN `grade` ENUM('中学生', '高校生', '大学生', 'その他') NOT NULL COMMENT '学年区分';

-- 確認用クエリ（実行後に確認）
-- SHOW COLUMNS FROM `gatb_results` LIKE 'grade';

