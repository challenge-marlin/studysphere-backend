-- ユーザーごとの学習ワークスペースレイアウト保存用カラム追加
-- react-grid-layout の layouts オブジェクトを JSON で保存（withAssignment / withoutAssignment 等）

USE `curriculum-portal`;

ALTER TABLE `user_accounts`
  ADD COLUMN `learning_workspace_layout` JSON DEFAULT NULL
  COMMENT '学習ページのワークスペースレイアウト（ドラッグ・リサイズ位置）' AFTER `instructor_id`;
