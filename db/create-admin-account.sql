-- 管理者アカウント作成スクリプト
-- 実行前にデータベースが初期化されていることを確認してください

USE `curriculum-portal`;

-- アドミニストレータ企業が存在しない場合は作成
INSERT IGNORE INTO `companies` (`id`, `name`) VALUES
(1, 'アドミニストレータ');

-- 管理者ユーザーアカウントを作成
INSERT IGNORE INTO `user_accounts` (`id`, `name`, `role`, `status`, `login_code`, `company_id`, `satellite_ids`) VALUES
(1, 'アドミン', 9, 1, 'ADMN-0001-0001', 1, NULL);

-- 管理者認証情報を作成（パスワード: admin123）
INSERT IGNORE INTO `admin_credentials` (`user_id`, `username`, `password_hash`) VALUES
(1, 'admin001', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.gS8O.m');

-- 確認用クエリ
SELECT 
    ua.id,
    ua.name,
    ua.role,
    ua.status,
    ua.login_code,
    ac.username,
    ac.created_at
FROM user_accounts ua
LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
WHERE ua.role = 9; 