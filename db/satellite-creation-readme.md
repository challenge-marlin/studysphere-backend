# 拠点データ作成 実行手順書

## 概要

現在の企業データに対応した拠点データを作成するマイグレーションです。

## 対象企業データ

```
ID: 1 - アドミニストレータ (max_users: 5)
ID: 2 - チャレンジラボラトリー（小倉BASE） (max_users: 20)
ID: 3 - ハッピーデザイン (max_users: 9)
ID: 5 - 仙台マーリン (max_users: 7)
ID: 6 - 仙台2号マーリン (max_users: 7) - 仙台マーリンのサテライトとして扱う
ID: 7 - ダイアモンドマーリン (max_users: 2)
ID: 8 - 九州朝鮮初中高級学校 (max_users: 10)
```

## 作成される拠点データ

### 通常の企業（本部のみ）

- アドミニストレータ: 本部
- チャレンジラボラトリー（小倉 BASE）: 本部
- ハッピーデザイン: 本部
- ダイアモンドマーリン: 本部
- 九州朝鮮初中高級学校: 本部

### 仙台マーリン（複数拠点）

- 仙台マーリン: 本部
- 仙台マーリン: 仙台 2 号マーリン（サテライト）

## 実行前の確認事項

### 1. データベースのバックアップ

```bash
# データベースのバックアップを作成
docker exec -it my-app-db-1 mysqldump -u root -ppassword curriculum-portal > backup_before_satellite_creation.sql
```

### 2. 現在の拠点データ確認

```sql
-- 既存の拠点データを確認
SELECT * FROM satellites;
```

### 3. 企業データの確認

```sql
-- 企業データを確認
SELECT id, name, max_users FROM companies WHERE id IN (1,2,3,5,6,7,8);
```

## マイグレーション実行

### 方法 1: SQL ファイルを直接実行

```bash
# データベースコンテナに接続
docker exec -it my-app-db-1 mysql -u root -ppassword curriculum-portal

# SQLファイルを実行
source /docker-entrypoint-initdb.d/create-satellites-from-companies.sql;
```

### 方法 2: コマンドラインから実行

```bash
# SQLファイルをデータベースに適用
docker exec -i my-app-db-1 mysql -u root -ppassword curriculum-portal < db/create-satellites-from-companies.sql
```

## 実行後の確認

### 1. 拠点データの確認

```sql
-- 作成された拠点データを確認
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
```

### 2. 期待される結果

```
+--------------+------------------+--------------------------------+----------+----------+--------+---------------------+
| satellite_id | satellite_name   | company_name                   | address  | max_users| status | created_at          |
+--------------+------------------+--------------------------------+----------+----------+--------+---------------------+
| 1            | 本部             | アドミニストレータ              | 未入力   | 5        | 1      | 2024-12-01 00:00:00 |
| 2            | 本部             | チャレンジラボラトリー（小倉BASE）| 未入力   | 20       | 1      | 2024-12-01 00:00:00 |
| 3            | 本部             | ハッピーデザイン                | 未入力   | 9        | 1      | 2024-12-01 00:00:00 |
| 4            | 本部             | 仙台マーリン                    | 未入力   | 7        | 1      | 2024-12-01 00:00:00 |
| 5            | 仙台2号マーリン   | 仙台マーリン                    | 未入力   | 7        | 1      | 2024-12-01 00:00:00 |
| 6            | 本部             | ダイアモンドマーリン            | 未入力   | 2        | 1      | 2024-12-01 00:00:00 |
| 7            | 本部             | 九州朝鮮初中高級学校            | 未入力   | 10       | 1      | 2024-12-01 00:00:00 |
+--------------+------------------+--------------------------------+----------+----------+--------+---------------------+
```

### 3. API 動作確認

```bash
# 企業の拠点一覧取得APIのテスト
curl -X GET http://localhost:5000/satellites/company/5

# 拠点詳細取得APIのテスト
curl -X GET http://localhost:5000/satellites/1
```

## ロールバック手順（必要な場合）

### 1. ロールバック用 SQL の実行

```sql
-- 作成した拠点データを削除
DELETE FROM satellites WHERE company_id IN (1,2,3,5,7,8);
```

### 2. ロールバック後の確認

```sql
-- 拠点データを確認
SELECT * FROM satellites;
```

## 注意事項

1. **仙台マーリンの特殊処理**: 仙台 2 号マーリン（ID: 6）は企業として登録されていますが、拠点データでは仙台マーリン（ID: 5）のサテライトとして扱います
2. **住所フィールド**: すべて「未入力」で設定しています（NULL 回避）
3. **上限人数**: 各企業の max_users をそのまま拠点の max_users にコピーしています
4. **ステータス**: すべて稼働中（1）で設定しています
5. **拠点名**: デフォルトで「本部」を使用しています

## トラブルシューティング

### エラー 1: 外部キー制約エラー

```
Error: Cannot add or update a child row: a foreign key constraint fails
```

**対処法**: 企業 ID が正しく存在することを確認してください。

### エラー 2: 重複エラー

```
Error: Duplicate entry for key
```

**対処法**: 既存の拠点データがある場合は、先に削除するか、SQL ファイルのコメントアウトを解除してください。

### エラー 3: 権限エラー

```
Error: Access denied for user 'root'@'localhost'
```

**対処法**: データベースの接続情報を確認してください。

## 完了確認チェックリスト

- [ ] データベースのバックアップが作成されている
- [ ] マイグレーションが正常に実行された
- [ ] 7 つの拠点データが作成されている
- [ ] 仙台マーリンに 2 つの拠点（本部、仙台 2 号マーリン）が作成されている
- [ ] 各拠点の上限人数が企業データと一致している
- [ ] すべての拠点のステータスが 1（稼働中）になっている
- [ ] API が正常に動作している
- [ ] 拠点一覧取得 API でデータが正しく表示される
