# 企業情報 API 仕様書

## 概要

企業情報の管理を行う API エンドポイントです。企業の基本情報（名前、住所、電話番号、利用者上限数）の CRUD 操作を提供します。

## ベース URL

```
http://localhost:5000
```

## エンドポイント一覧

### 1. 企業一覧取得

**GET** `/companies`

企業の一覧を取得します。

#### レスポンス

```json
[
  {
    "id": 1,
    "name": "サンプル企業株式会社",
    "address": "東京都渋谷区○○○ 1-2-3",
    "phone": "03-1234-5678",
    "office_type_id": 1,
    "office_type_name": "就労移行支援事務所",
    "token_issued_at": "2024-01-01T00:00:00.000Z",
    "token_expiry_at": "2025-01-01T00:00:00.000Z",
    "max_users": 10,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

### 2. 企業詳細取得

**GET** `/companies/:id`

指定された ID の企業情報を取得します。

#### パラメータ

- `id` (number): 企業 ID

#### レスポンス

```json
{
  "id": 1,
  "name": "サンプル企業株式会社",
  "address": "東京都渋谷区○○○ 1-2-3",
  "phone": "03-1234-5678",
  "token_issued_at": "2024-01-01T00:00:00.000Z",
  "token_expiry_at": "2025-01-01T00:00:00.000Z",
  "max_users": 10,
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

#### エラーレスポンス

```json
{
  "message": "企業が見つかりません"
}
```

### 3. 企業作成

**POST** `/companies`

新しい企業を作成します。

#### リクエストボディ

```json
{
  "name": "新規企業株式会社",
  "address": "東京都新宿区○○○ 4-5-6",
  "phone": "03-9876-5432",
  "max_users": 20
}
```

#### バリデーションルール

- `name`: 必須、1-255 文字
- `address`: 任意、最大 65535 文字
- `phone`: 任意、数字・ハイフン・括弧・スペースのみ
- `max_users`: 任意、1-10000 の整数（デフォルト: 5）

#### レスポンス

```json
{
  "success": true,
  "message": "企業情報が正常に作成されました",
  "data": {
    "id": 2,
    "name": "新規企業株式会社",
    "address": "東京都新宿区○○○ 4-5-6",
    "phone": "03-9876-5432",
    "token_issued_at": "2024-12-01T00:00:00.000Z",
    "token_expiry_at": "2025-12-01T00:00:00.000Z",
    "max_users": 20,
    "created_at": "2024-12-01T00:00:00.000Z"
  }
}
```

### 4. 企業更新

**PUT** `/companies/:id`

指定された ID の企業情報を更新します。

#### パラメータ

- `id` (number): 企業 ID

#### リクエストボディ

```json
{
  "name": "更新企業株式会社",
  "address": "東京都港区○○○ 7-8-9",
  "phone": "03-1111-2222",
  "max_users": 30
}
```

#### バリデーションルール

- `name`: 任意、1-255 文字
- `address`: 任意、最大 65535 文字
- `phone`: 任意、数字・ハイフン・括弧・スペースのみ
- `max_users`: 任意、1-10000 の整数

#### レスポンス

```json
{
  "success": true,
  "message": "企業情報が正常に更新されました",
  "data": {
    "id": 1,
    "name": "更新企業株式会社",
    "address": "東京都港区○○○ 7-8-9",
    "phone": "03-1111-2222",
    "token_issued_at": "2024-01-01T00:00:00.000Z",
    "token_expiry_at": "2025-01-01T00:00:00.000Z",
    "max_users": 30,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 5. 企業削除

**DELETE** `/companies/:id`

指定された ID の企業を削除します。

#### パラメータ

- `id` (number): 企業 ID

#### レスポンス

```json
{
  "success": true,
  "message": "企業情報が正常に削除されました"
}
```

#### エラーレスポンス

```json
{
  "success": false,
  "message": "この企業に所属するユーザーが存在するため削除できません"
}
```

## エラーレスポンス

### バリデーションエラー

```json
{
  "success": false,
  "message": "入力データにエラーがあります",
  "errors": [
    {
      "type": "field",
      "value": "",
      "msg": "企業名は1文字以上255文字以下で入力してください",
      "path": "name",
      "location": "body"
    }
  ]
}
```

### サーバーエラー

```json
{
  "success": false,
  "message": "企業情報の取得に失敗しました",
  "error": "データベース接続エラー"
}
```

## データベーススキーマ

### office_types テーブル

```sql
CREATE TABLE `office_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '事業所タイプID',
    `type` VARCHAR(100) NOT NULL COMMENT '事業所タイプ名',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    UNIQUE KEY `unique_type` (`type`)
) COMMENT = '事業所タイプテーブル';
```

### companies テーブル

```sql
CREATE TABLE `companies` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '企業ID',
    `name` VARCHAR(255) NOT NULL COMMENT '企業名',
    `address` TEXT DEFAULT NULL COMMENT '企業住所',
    `phone` VARCHAR(20) DEFAULT NULL COMMENT '企業電話番号',
    `office_type_id` INT DEFAULT NULL COMMENT '事業所タイプID',
    `token_issued_at` DATETIME NOT NULL COMMENT 'トークン発行日',
    `token_expiry_at` DATETIME NOT NULL COMMENT 'トークン有効期限',
    `max_users` INT NOT NULL DEFAULT 5 COMMENT 'ロール1の上限登録人数',
    FOREIGN KEY (`office_type_id`) REFERENCES `office_types`(`id`) ON DELETE SET NULL
) COMMENT = '企業情報テーブル';
```

## 注意事項

1. **住所フィールド**: TEXT 型のため、長い住所も保存可能です
2. **電話番号フィールド**: 数字、ハイフン、括弧、スペースのみ使用可能です
3. **削除制限**: 企業に所属するユーザーが存在する場合は削除できません
4. **トークン管理**: 企業作成時に自動的にトークンが発行され、1 年間有効です
5. **利用者上限**: 企業全体の利用者上限数を管理します（拠点別の上限とは別）
