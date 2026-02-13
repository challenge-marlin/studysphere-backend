-- ユーザーごとの学習ウィジェット表示設定（on/off）保存用カラム追加
-- { "video": true, "text": true, "chat": true, "assignment": true } を JSON で保存

USE `curriculum-portal`;

ALTER TABLE `user_accounts`
  ADD COLUMN `learning_widget_visibility` JSON DEFAULT NULL
  COMMENT '学習ページのウィジェット表示 on/off' AFTER `learning_workspace_layout`;
