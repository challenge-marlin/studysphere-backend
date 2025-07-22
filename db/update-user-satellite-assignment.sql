-- ユーザーアカウントのサテライトID振り分けと所属企業修正
-- 実行日時: 2024年12月

USE `curriculum-portal`;

-- 1. 仙台2号マーリン（企業ID: 6）のユーザーを仙台マーリン（企業ID: 5）に変更
UPDATE `user_accounts` 
SET `company_id` = 5 
WHERE `company_id` = 6 AND `role` != 9;

-- 2. 拠点データの確認（実行前）
SELECT 
    s.id as satellite_id,
    s.name as satellite_name,
    c.id as company_id,
    c.name as company_name
FROM satellites s
JOIN companies c ON s.company_id = c.id
ORDER BY c.id, s.id;

-- 3. ロール9以外のユーザーにサテライトIDを振り分け

-- アドミニストレータ（企業ID: 1）のユーザー → 拠点ID: 1（本部）
UPDATE `user_accounts` 
SET `satellite_id` = 1 
WHERE `company_id` = 1 AND `role` != 9;

-- チャレンジラボラトリー（小倉BASE）（企業ID: 2）のユーザー → 拠点ID: 2（本部）
UPDATE `user_accounts` 
SET `satellite_id` = 2 
WHERE `company_id` = 2 AND `role` != 9;

-- ハッピーデザイン（企業ID: 3）のユーザー → 拠点ID: 3（本部）
UPDATE `user_accounts` 
SET `satellite_id` = 3 
WHERE `company_id` = 3 AND `role` != 9;

-- 仙台マーリン（企業ID: 5）のユーザー振り分け
-- 元々仙台マーリン所属のユーザー → 拠点ID: 4（本部）
UPDATE `user_accounts` 
SET `satellite_id` = 4 
WHERE `company_id` = 5 AND `role` != 9 AND `id` IN (37, 38, 39, 40, 41, 42, 43);

-- 元々仙台2号マーリン所属のユーザー → 拠点ID: 5（仙台2号マーリン）
UPDATE `user_accounts` 
SET `satellite_id` = 5 
WHERE `company_id` = 5 AND `role` != 9 AND `id` IN (44, 45, 46, 47, 48, 49, 59);

-- ダイアモンドマーリン（企業ID: 7）のユーザー → 拠点ID: 6（本部）
UPDATE `user_accounts` 
SET `satellite_id` = 6 
WHERE `company_id` = 7 AND `role` != 9;

-- 九州朝鮮初中高級学校（企業ID: 8）のユーザー → 拠点ID: 7（本部）
UPDATE `user_accounts` 
SET `satellite_id` = 7 
WHERE `company_id` = 8 AND `role` != 9;

-- 4. 更新結果の確認
SELECT 
    ua.id,
    ua.name,
    ua.role,
    ua.company_id,
    c.name as company_name,
    ua.satellite_id,
    s.name as satellite_name,
    ua.is_remote_user
FROM user_accounts ua
LEFT JOIN companies c ON ua.company_id = c.id
LEFT JOIN satellites s ON ua.satellite_id = s.id
WHERE ua.role != 9
ORDER BY ua.company_id, ua.satellite_id, ua.id; 