USE curriculum-portal;

-- 管理者ユーザーアカウントを作成
INSERT INTO user_accounts (name, role, status, login_code, company_id) 
VALUES ('admin001', 9, 1, 'CGA8-CH0R-QVEC', NULL);

-- 管理者認証情報を作成
INSERT INTO admin_credentials (user_id, username, password_hash) 
SELECT ua.id, 'admin001', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O'
FROM user_accounts ua 
WHERE ua.name = 'admin001'; 