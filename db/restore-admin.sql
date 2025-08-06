-- 管理者アカウント復元スクリプト
USE `curriculum-portal`;

-- 既存の管理者アカウントを削除（重複を避けるため）
DELETE FROM admin_credentials WHERE username = 'admin001';
DELETE FROM user_accounts WHERE name = 'admin001';

-- 管理者ユーザーアカウントを作成（マスターユーザー：ロール10）
INSERT INTO user_accounts (name, role, status, login_code, company_id) 
VALUES ('admin001', 10, 1, 'CGA8-CH0R-QVEC', NULL);

-- 管理者認証情報を作成（パスワード: admin123）
INSERT INTO admin_credentials (user_id, username, password_hash) 
SELECT ua.id, 'admin001', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O'
FROM user_accounts ua 
WHERE ua.name = 'admin001';

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