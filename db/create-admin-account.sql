-- 管理者アカウント作成スクリプト
-- パスワード: admin123 (bcryptハッシュ)

USE `curriculum-portal`;

-- システム管理者ユーザーアカウントを作成
INSERT INTO `user_accounts` (`name`, `role`, `status`, `login_code`, `company_id`) 
VALUES ('システム管理者', 9, 1, 'ADMIN-0001-001', NULL)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 管理者ユーザーアカウントを作成
INSERT INTO `user_accounts` (`name`, `role`, `status`, `login_code`, `company_id`) 
VALUES ('admin001', 9, 1, 'CGA8-CH0R-QVEC', NULL)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 管理者認証情報を作成
-- パスワード: admin123 のbcryptハッシュ
INSERT INTO `admin_credentials` (`user_id`, `username`, `password_hash`) 
SELECT ua.id, 'admin001', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O'
FROM `user_accounts` ua 
WHERE ua.name = 'admin001'
ON DUPLICATE KEY UPDATE 
    `username` = VALUES(`username`),
    `password_hash` = VALUES(`password_hash`);

-- 確認用クエリ
SELECT 
    ua.id,
    ua.name,
    ua.role,
    ua.login_code,
    ac.username,
    ac.created_at
FROM `user_accounts` ua
LEFT JOIN `admin_credentials` ac ON ua.id = ac.user_id
WHERE ua.role >= 5; 