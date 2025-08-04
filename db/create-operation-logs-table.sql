-- 操作ログテーブルの作成
CREATE TABLE IF NOT EXISTS operation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id VARCHAR(255) NOT NULL COMMENT '管理者ID',
  admin_name VARCHAR(255) NOT NULL COMMENT '管理者名',
  action VARCHAR(255) NOT NULL COMMENT '操作内容',
  details TEXT COMMENT '詳細情報',
  ip_address VARCHAR(45) COMMENT 'IPアドレス',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  INDEX idx_admin_id (admin_id),
  INDEX idx_admin_name (admin_name),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作ログテーブル';

-- サンプルデータの挿入（オプション）
INSERT INTO operation_logs (admin_id, admin_name, action, details, ip_address) VALUES
('admin001', 'システム管理者', 'ログイン', '管理者ダッシュボードにログインしました', '127.0.0.1'),
('admin001', 'システム管理者', '管理者作成', '新しい管理者「田中管理者」を作成しました', '127.0.0.1'),
('admin001', 'システム管理者', '拠点作成', '新しい拠点「東京支店」を作成しました', '127.0.0.1'),
('admin001', 'システム管理者', '指導員作成', '新しい指導員「佐藤指導員」を作成しました', '127.0.0.1'); 