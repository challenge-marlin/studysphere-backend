# ユーザーアカウント サテライト ID 振り分け・所属企業修正 実行手順書

## 概要

ユーザーアカウントのサテライト ID 振り分けと所属企業の修正を行うマイグレーションです。

## 対象ユーザーデータ

```
ロール9（アドミン）以外のユーザーが対象
- 仙台2号マーリン（企業ID: 6）のユーザーを仙台マーリン（企業ID: 5）に変更
- 各拠点へのサテライトID振り分け
```

## 実行される変更

### 1. 所属企業の変更

- **仙台 2 号マーリン所属ユーザー**: 企業 ID 6 → 5（仙台マーリン）に変更

### 2. サテライト ID 振り分け

#### アドミニストレータ（企業 ID: 1）

- **拠点**: 本部（拠点 ID: 1）
- **対象ユーザー**: デモユーザ（ID: 18）

#### チャレンジラボラトリー（小倉 BASE）（企業 ID: 2）

- **拠点**: 本部（拠点 ID: 2）
- **対象ユーザー**: 末吉元気、小渕正明、古賀智絵、下瀬章継、楠野翔悟、佐藤茂利、盛内稔史、ゲスト

#### ハッピーデザイン（企業 ID: 3）

- **拠点**: 本部（拠点 ID: 3）
- **対象ユーザー**: 一柳知寿、梅本天、勝部順子、田中健太、長谷川蓮、山田稔、古谷将都、笠井昂、尾辻俊輔

#### 仙台マーリン（企業 ID: 5）

- **拠点 1**: 本部（拠点 ID: 4）
  - **対象ユーザー**: 安藤寛、前田泰祐、塩崎直子、林智恵美、堀江夏月、風間瞳子、園田哲也
- **拠点 2**: 仙台 2 号マーリン（拠点 ID: 5）
  - **対象ユーザー**: 大成彩水、菊地杏子、佐藤大輔、沼田弘樹、宗村健秀、葛西千晶、佐藤史隆

#### ダイアモンドマーリン（企業 ID: 7）

- **拠点**: 本部（拠点 ID: 6）
- **対象ユーザー**: なし（現在該当ユーザーなし）

#### 九州朝鮮初中高級学校（企業 ID: 8）

- **拠点**: 本部（拠点 ID: 7）
- **対象ユーザー**: 김한성、문리영、박세창、홍유우、김유실、金潤基

## 実行前の確認事項

### 1. データベースのバックアップ

```bash
# データベースのバックアップを作成
docker exec -it my-app-db-1 mysqldump -u root -ppassword curriculum-portal > backup_before_user_assignment.sql
```

### 2. 現在のユーザーデータ確認

```sql
-- 現在のユーザーアカウントを確認
SELECT
    id, name, role, company_id, satellite_id, is_remote_user
FROM user_accounts
WHERE role != 9
ORDER BY company_id, id;
```

### 3. 拠点データの確認

```sql
-- 拠点データを確認
SELECT
    s.id as satellite_id,
    s.name as satellite_name,
    c.id as company_id,
    c.name as company_name
FROM satellites s
JOIN companies c ON s.company_id = c.id
ORDER BY c.id, s.id;
```

## マイグレーション実行

### 方法 1: SQL ファイルを直接実行

```bash
# データベースコンテナに接続
docker exec -it my-app-db-1 mysql -u root -ppassword curriculum-portal

# SQLファイルを実行
source /docker-entrypoint-initdb.d/update-user-satellite-assignment.sql;
```

### 方法 2: コマンドラインから実行

```bash
# SQLファイルをデータベースに適用
docker exec -i my-app-db-1 mysql -u root -ppassword curriculum-portal < db/update-user-satellite-assignment.sql
```

## 実行後の確認

### 1. 更新結果の確認

```sql
-- 更新後のユーザーアカウントを確認
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
```

### 2. 期待される結果（主要な変更点）

#### 仙台 2 号マーリン所属ユーザーの企業 ID 変更

```
ID: 44-49, 59 のユーザー
company_id: 6 → 5
```

#### サテライト ID 振り分け

```
アドミニストレータ: satellite_id = 1
チャレンジラボラトリー: satellite_id = 2
ハッピーデザイン: satellite_id = 3
仙台マーリン本部: satellite_id = 4
仙台2号マーリン: satellite_id = 5
ダイアモンドマーリン: satellite_id = 6
九州朝鮮初中高級学校: satellite_id = 7
```

### 3. API 動作確認

```bash
# 拠点の利用者数取得APIのテスト
curl -X GET http://localhost:5000/satellites/1/users/count
curl -X GET http://localhost:5000/satellites/2/users/count
curl -X GET http://localhost:5000/satellites/4/users/count
curl -X GET http://localhost:5000/satellites/5/users/count

# 企業の拠点一覧取得APIのテスト
curl -X GET http://localhost:5000/satellites/company/5
```

## ロールバック手順（必要な場合）

### 1. ロールバック用 SQL の実行

```sql
-- サテライトIDをクリア
UPDATE user_accounts SET satellite_id = NULL WHERE role != 9;

-- 仙台2号マーリン所属ユーザーを元に戻す
UPDATE user_accounts
SET company_id = 6
WHERE id IN (44, 45, 46, 47, 48, 49, 59);
```

### 2. ロールバック後の確認

```sql
-- ユーザーアカウントを確認
SELECT
    id, name, role, company_id, satellite_id
FROM user_accounts
WHERE role != 9
ORDER BY company_id, id;
```

## 注意事項

1. **ロール 9（アドミン）の除外**: アドミンユーザーはサテライト ID を設定しません
2. **仙台マーリンの複数拠点**: 元々の所属企業に基づいて本部と仙台 2 号マーリンに振り分けます
3. **データ整合性**: 外部キー制約により、存在しない拠点 ID は設定できません
4. **在宅支援ユーザー**: is_remote_user フラグは変更しません

## トラブルシューティング

### エラー 1: 外部キー制約エラー

```
Error: Cannot add or update a child row: a foreign key constraint fails
```

**対処法**: 拠点データが正しく作成されていることを確認してください。

### エラー 2: データ不整合

```
Error: Data truncated for column
```

**対処法**: 拠点 ID が正しい範囲内であることを確認してください。

### エラー 3: 権限エラー

```
Error: Access denied for user 'root'@'localhost'
```

**対処法**: データベースの接続情報を確認してください。

## 完了確認チェックリスト

- [ ] データベースのバックアップが作成されている
- [ ] マイグレーションが正常に実行された
- [ ] 仙台 2 号マーリン所属ユーザーの企業 ID が 5 に変更されている
- [ ] ロール 9 以外のユーザーにサテライト ID が設定されている
- [ ] 仙台マーリンのユーザーが本部と仙台 2 号マーリンに正しく振り分けられている
- [ ] 各拠点の利用者数が正しく表示される
- [ ] API が正常に動作している
- [ ] 拠点一覧取得 API でデータが正しく表示される
