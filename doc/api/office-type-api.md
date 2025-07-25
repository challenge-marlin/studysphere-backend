# 事業所タイプ API 仕様書

## 概要

事業所タイプの管理を行う API エンドポイントです。事業所の種類（就労移行支援事務所、就労継続支援 A 型事務所など）の CRUD 操作を提供します。

## ベース URL

```
http://localhost:5000
```

## エンドポイント一覧

### 1. 事業所タイプ一覧取得

**GET** `/office-types`

事業所タイプの一覧を取得します。

#### レスポンス

```json
[
  {
    "id": 1,
    "type": "就労移行支援事務所",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": 2,
    "type": "就労継続支援A型事務所",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

### 2. 事業所タイプ詳細取得

**GET** `/office-types/:id`

指定された ID の事業所タイプ情報を取得します。

#### パラメータ

- `id` (number): 事業所タイプ ID

#### レスポンス

```json
{
  "id": 1,
  "type": "就労移行支援事務所",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

#### エラーレスポンス

```json
{
  "message": "事業所タイプが見つかりません"
}
```

### 3. 事業所タイプ作成

**POST** `/office-types`

新しい事業所タイプを作成します。

#### リクエストボディ

```json
{
  "type": "新規事業所タイプ"
}
```

#### バリデーションルール

- `type`: 必須、1-100 文字

#### レスポンス

```json
{
  "success": true,
  "message": "事業所タイプが正常に作成されました",
  "data": {
    "id": 10,
    "type": "新規事業所タイプ",
    "created_at": "2024-12-01T00:00:00.000Z"
  }
}
```

### 4. 事業所タイプ更新

**PUT** `/office-types/:id`

指定された ID の事業所タイプ情報を更新します。

#### パラメータ

- `id` (number): 事業所タイプ ID

#### リクエストボディ

```json
{
  "type": "更新された事業所タイプ"
}
```

#### バリデーションルール

- `type`: 必須、1-100 文字

#### レスポンス

```json
{
  "success": true,
  "message": "事業所タイプが正常に更新されました",
  "data": {
    "id": 1,
    "type": "更新された事業所タイプ",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 5. 事業所タイプ削除

**DELETE** `/office-types/:id`

指定された ID の事業所タイプを削除します。

#### パラメータ

- `id` (number): 事業所タイプ ID

#### レスポンス

```json
{
  "success": true,
  "message": "事業所タイプが正常に削除されました"
}
```

#### エラーレスポンス

```json
{
  "success": false,
  "message": "この事業所タイプを使用している企業が存在するため削除できません"
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
      "msg": "事業所タイプ名は1文字以上100文字以下で入力してください",
      "path": "type",
      "location": "body"
    }
  ]
}
```

### サーバーエラー

```json
{
  "success": false,
  "message": "事業所タイプの取得に失敗しました",
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

## サンプルデータ

```sql
INSERT INTO `office_types` (`id`, `type`) VALUES
(1, '就労移行支援事務所'),
(2, '就労継続支援A型事務所'),
(3, '就労継続支援B型事務所'),
(4, '生活介護事務所'),
(5, '自立訓練事務所'),
(6, '就労定着支援事務所'),
(7, '地域活動支援センター'),
(8, '福祉ホーム'),
(9, 'その他');
```

## 注意事項

1. **一意性制約**: 事業所タイプ名は重複できません
2. **削除制限**: 事業所タイプを使用している企業が存在する場合は削除できません
3. **外部キー制約**: 企業情報テーブル（companies）から参照されています
4. **デフォルトデータ**: システム初期化時に 9 種類の事業所タイプが自動的に作成されます
