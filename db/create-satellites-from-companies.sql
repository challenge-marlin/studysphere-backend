-- 企業データに対応した拠点データ作成
-- 実行日時: 2024年12月

USE `curriculum-portal`;

-- 既存の拠点データをクリア（オプション）
-- DELETE FROM satellites;

-- 企業データに対応した拠点データを作成
INSERT INTO `satellites` (`company_id`, `name`, `address`, `max_users`, `status`) VALUES
-- アドミニストレータ
(1, '本部', '未入力', 5, 1),

-- チャレンジラボラトリー（小倉BASE）
(2, '本部', '未入力', 20, 1),

-- ハッピーデザイン
(3, '本部', '未入力', 9, 1),

-- 仙台マーリン（本部）
(5, '本部', '未入力', 7, 1),

-- 仙台2号マーリン（仙台マーリンのサテライト）
(5, '仙台2号マーリン', '未入力', 7, 1),

-- ダイアモンドマーリン
(7, '本部', '未入力', 2, 1),

-- 九州朝鮮初中高級学校
(8, '本部', '未入力', 10, 1);

-- 作成された拠点データの確認
SELECT 
    s.id as satellite_id,
    s.name as satellite_name,
    c.name as company_name,
    s.address,
    s.max_users,
    s.status,
    s.created_at
FROM satellites s
JOIN companies c ON s.company_id = c.id
ORDER BY c.id, s.id; 