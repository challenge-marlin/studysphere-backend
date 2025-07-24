-- 管理者パスワードハッシュ更新スクリプト
-- パスワード: admin123

USE `curriculum-portal`;

-- admin001のパスワードハッシュを更新
UPDATE `admin_credentials` 
SET `password_hash` = '$2a$12$.TzgYxDTc2RafOkTxoQzFO5WrOtgVFo7dQdiv5pJ7JKTinlTo/BAy'
WHERE `username` = 'admin001';

-- 確認用クエリ
SELECT 
    ac.username,
    ac.password_hash,
    ua.name,
    ua.role,
    ua.status
FROM `admin_credentials` ac 
JOIN `user_accounts` ua ON ac.user_id = ua.id 
WHERE ac.username = 'admin001'; 