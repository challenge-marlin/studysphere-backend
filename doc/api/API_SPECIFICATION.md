# StudySphere Backend API 仕様書

## 概要

StudySphere Backend APIは、カリキュラムポータルシステムのバックエンドAPIです。Node.js/Express.js、MySQL、JWT認証を使用して構築されています。

### 基本情報
- **ベースURL**: `http://localhost:5050` (開発環境)
- **認証方式**: JWT (JSON Web Token)
- **データベース**: MySQL 8.0
- **時間管理**: バックエンド（UTC）⇔フロントエンド（JST）変換

### 技術スタック
- **フレームワーク**: Express.js 4.18.2
- **認証**: JWT (jsonwebtoken)
- **データベース**: MySQL2
- **ファイルストレージ**: AWS S3
- **AI機能**: OpenAI GPT-4o
- **PDF処理**: pdf-parse, pdfjs-dist
- **バリデーション**: express-validator

## 認証システム

### ロール体系
- **ロール10**: マスターユーザー（システム管理者）
- **ロール9**: アドミン（管理者）
- **ロール5**: 管理者（拠点管理者）
- **ロール4**: 指導員
- **ロール1**: 利用者

### 認証フロー
1. 管理者ログイン: `/api/login`
2. 指導員ログイン: `/api/instructor-login`
3. トークンリフレッシュ: `/api/refresh`
4. ログアウト: `/api/logout`

## API エンドポイント一覧

### 1. 認証関連 (`/api`)

#### POST `/api/login`
管理者ログイン

**説明:** 管理者（ロール5以上）のログイン処理。認証成功後、アクセストークンとリフレッシュトークンを発行します。

**認証:** 不要

**バリデーション:** 
- `username`: 必須、文字列
- `password`: 必須、文字列

**リクエスト:**
```json
{
  "username": "admin001",
  "password": "admin123"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "ログインに成功しました",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": 1,
      "userName": "admin001",
      "role": 9
    }
  }
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 400/401
```json
{
  "success": false,
  "message": "ユーザー名またはパスワードが正しくありません",
  "error": "INVALID_CREDENTIALS"
}
```

**エラーケース:**
- 400: バリデーションエラー（username/passwordが未指定）
- 401: 認証失敗（ユーザー名またはパスワードが間違っている）
- 500: サーバーエラー

#### POST `/api/instructor-login`
指導員ログイン（企業・拠点選択）

**説明:** 指導員（ロール4）のログイン処理。企業と拠点を選択してログインします。認証成功後、アクセストークンとリフレッシュトークンを発行します。

**認証:** 不要

**バリデーション:**
- `username`: 必須、文字列
- `password`: 必須、文字列
- `companyId`: 必須、整数
- `satelliteId`: 必須、整数

**リクエスト:**
```json
{
  "username": "instructor001",
  "password": "password123",
  "companyId": 1,
  "satelliteId": 1
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "ログインに成功しました",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": 1,
      "userName": "instructor001",
      "role": 4,
      "companyId": 1,
      "satelliteId": 1
    }
  }
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 400/401
```json
{
  "success": false,
  "message": "ユーザー名またはパスワードが正しくありません",
  "error": "INVALID_CREDENTIALS"
}
```

**エラーケース:**
- 400: バリデーションエラー（必須パラメータが未指定、または企業・拠点が存在しない）
- 401: 認証失敗（ユーザー名またはパスワードが間違っている、または指定された企業・拠点に所属していない）
- 500: サーバーエラー

#### POST `/api/refresh`
トークンリフレッシュ

**説明:** リフレッシュトークンを使用して新しいアクセストークンを取得します。

**認証:** 不要（リフレッシュトークンが必要）

**バリデーション:**
- `refresh_token`: 必須、文字列（JWT形式）

**リクエスト:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "トークンが更新されました",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 401
```json
{
  "success": false,
  "message": "リフレッシュトークンが無効です",
  "error": "INVALID_REFRESH_TOKEN"
}
```

**エラーケース:**
- 400: バリデーションエラー（refresh_tokenが未指定）
- 401: トークンが無効または期限切れ
- 500: サーバーエラー

#### POST `/api/logout`
ログアウト

**説明:** リフレッシュトークンを無効化してログアウトします。

**認証:** 不要

**バリデーション:**
- `refresh_token`: 必須、文字列（JWT形式）

**リクエスト:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "ログアウトしました"
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 400
```json
{
  "success": false,
  "message": "リフレッシュトークンが指定されていません",
  "error": "REFRESH_TOKEN_REQUIRED"
}
```

**エラーケース:**
- 400: バリデーションエラー（refresh_tokenが未指定）
- 500: サーバーエラー

#### GET `/api/user-info`
現在のユーザー情報取得

**説明:** 現在ログイン中のユーザー情報を取得します。

**認証:** 必須（JWTトークン）

**ヘッダー:**
```
Authorization: Bearer <access_token>
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "userName": "admin001",
    "role": 9,
    "companyId": 1,
    "satelliteIds": [1, 2],
    "companyName": "株式会社サンプル",
    "satellites": [
      {
        "id": 1,
        "name": "渋谷拠点"
      }
    ]
  }
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 401
```json
{
  "success": false,
  "message": "認証が必要です",
  "error": "UNAUTHORIZED"
}
```

**エラーケース:**
- 401: 認証トークンが無効または期限切れ
- 500: サーバーエラー

#### POST `/api/user-companies/:username`
ユーザーの企業・拠点情報取得

**説明:** 指定されたユーザー名の企業・拠点情報を取得します（指導員ログイン時の企業・拠点選択用）。

**認証:** 不要

**パラメータ:**
- `username`: 必須、文字列（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "companies": [
      {
        "id": 1,
        "name": "株式会社サンプル",
        "satellites": [
          {
            "id": 1,
            "name": "渋谷拠点"
          }
        ]
      }
    ]
  }
}
```

#### POST `/api/reauthenticate-satellite`
拠点変更時の再認証

**説明:** 拠点を変更する際に、新しい拠点情報で再認証します。

**認証:** 必須（JWTトークン）

**バリデーション:**
- `satelliteId`: 必須、整数
- `userId`: オプション、整数（指定しない場合はトークンから取得）

**リクエスト:**
```json
{
  "satelliteId": 2,
  "userId": 1
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "拠点が変更されました",
  "data": {
    "satelliteId": 2,
    "satelliteName": "新宿拠点"
  }
}
```

#### POST `/api/restore-master-user`
マスターユーザー復旧

**説明:** マスターユーザー（ロール10）を復旧します。緊急時の復旧用エンドポイントです。

**認証:** 不要

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "マスターユーザーが復旧されました",
  "data": {
    "userId": 1,
    "userName": "master",
    "role": 10
  }
}
```

#### POST `/api/config`
設定用認証（ロール4以上）

**説明:** 設定画面用の認証エンドポイント。ロール4以上のユーザーのみ認証成功します。

**認証:** 不要

**バリデーション:**
- `username`: 必須、文字列
- `password`: 必須、文字列

**リクエスト:**
```json
{
  "username": "instructor001",
  "password": "password123"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "認証に成功しました",
  "role": 4,
  "data": {
    "userId": 1,
    "userName": "instructor001",
    "role": 4
  }
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 403
```json
{
  "success": false,
  "message": "ロール4以上の権限が必要です",
  "role": 1
}
```

### 2. 企業管理 (`/api/companies`)

#### GET `/api/companies`
企業一覧取得

**説明:** すべての企業情報の一覧を取得します。

**認証:** 不要（ただし、管理者のみアクセス可能な場合あり）

**クエリパラメータ:** なし

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
[
  {
    "id": 1,
    "name": "株式会社サンプル",
    "address": "東京都渋谷区...",
    "phone": "03-1234-5678",
    "token": "COMP-0001-0001",
    "token_issued_at": "2024-01-01T00:00:00.000Z",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
]
```

**エラーケース:**
- 500: サーバーエラー

#### GET `/api/companies/:id`
企業詳細取得

**説明:** 指定されたIDの企業詳細情報を取得します。

**認証:** 不要

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "id": 1,
  "name": "株式会社サンプル",
  "address": "東京都渋谷区...",
  "phone": "03-1234-5678",
  "token": "COMP-0001-0001",
  "token_issued_at": "2024-01-01T00:00:00.000Z",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 404
```json
{
  "message": "企業が見つかりません",
  "error": "COMPANY_NOT_FOUND"
}
```

**エラーケース:**
- 404: 企業が見つからない
- 500: サーバーエラー

#### POST `/api/companies`
企業作成

**説明:** 新しい企業を作成します。企業トークンは自動生成されます。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**バリデーション:**
- `name`: 必須、文字列（1-255文字）
- `address`: オプション、文字列（最大65535文字）
- `phone`: オプション、文字列（数字・ハイフン・括弧・スペースのみ、最大20文字）

**リクエスト:**
```json
{
  "name": "株式会社新規企業",
  "address": "東京都新宿区...",
  "phone": "03-9876-5432"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 201
```json
{
  "success": true,
  "message": "企業が作成されました",
  "data": {
    "id": 2,
    "name": "株式会社新規企業",
    "address": "東京都新宿区...",
    "phone": "03-9876-5432",
    "token": "COMP-0002-0001",
    "token_issued_at": "2024-01-01T00:00:00.000Z",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 400
```json
{
  "success": false,
  "message": "バリデーションエラー",
  "error": "VALIDATION_ERROR",
  "details": [
    {
      "field": "name",
      "message": "企業名は必須です"
    }
  ]
}
```

**エラーケース:**
- 400: バリデーションエラー
- 500: サーバーエラー

#### PUT `/api/companies/:id`
企業更新

**説明:** 指定されたIDの企業情報を更新します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `name`: オプション、文字列（1-255文字）
- `address`: オプション、文字列（最大65535文字）
- `phone`: オプション、文字列（数字・ハイフン・括弧・スペースのみ、最大20文字）

**リクエスト:**
```json
{
  "name": "株式会社更新企業",
  "address": "東京都港区...",
  "phone": "03-1111-2222"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "企業情報が更新されました",
  "data": {
    "id": 1,
    "name": "株式会社更新企業",
    "address": "東京都港区...",
    "phone": "03-1111-2222",
    "updated_at": "2024-01-02T00:00:00.000Z"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 404: 企業が見つからない
- 500: サーバーエラー

#### DELETE `/api/companies/:id`
企業削除

**説明:** 指定されたIDの企業を削除します。関連する拠点やユーザーとの整合性に注意が必要です。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "企業が削除されました"
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 400
```json
{
  "success": false,
  "message": "関連する拠点が存在するため削除できません",
  "error": "HAS_RELATED_SATELLITES"
}
```

**エラーケース:**
- 400: 関連データが存在するため削除不可
- 404: 企業が見つからない
- 500: サーバーエラー

#### POST `/api/companies/:id/regenerate-token`
企業トークン再生成

**説明:** 指定された企業のトークンを再生成します。既存の利用者ログインには影響しません。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "企業トークンが再生成されました",
  "data": {
    "id": 1,
    "token": "COMP-0001-0002",
    "token_issued_at": "2024-01-02T00:00:00.000Z"
  }
}
```

**エラーケース:**
- 404: 企業が見つからない
- 500: サーバーエラー

### 3. 拠点管理 (`/api/satellites`)

#### GET `/api/satellites`
拠点一覧取得

**説明:** すべての拠点情報の一覧を取得します。

**認証:** 不要

**クエリパラメータ:** なし

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "company_id": 1,
      "name": "渋谷拠点",
      "address": "東京都渋谷区...",
      "phone": "03-1234-5678",
      "office_type_id": 1,
      "token": "SATE-0001-0001",
      "contract_type": "30days",
      "max_users": 50,
      "status": 1,
      "token_issued_at": "2024-01-01T00:00:00.000Z",
      "token_expiry_at": "2024-02-01T00:00:00.000Z",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET `/api/satellites/:id`
拠点詳細取得

**説明:** 指定されたIDの拠点詳細情報を取得します。

**認証:** 不要

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "id": 1,
    "company_id": 1,
    "name": "渋谷拠点",
    "address": "東京都渋谷区...",
    "phone": "03-1234-5678",
    "office_type_id": 1,
    "token": "SATE-0001-0001",
    "contract_type": "30days",
    "max_users": 50,
    "status": 1,
    "manager_ids": [1, 2],
    "disabled_course_ids": [5],
    "token_issued_at": "2024-01-01T00:00:00.000Z",
    "token_expiry_at": "2024-02-01T00:00:00.000Z"
  }
}
```

**エラーケース:**
- 404: 拠点が見つからない
- 500: サーバーエラー

#### GET `/api/satellites/by-ids?ids=[1,2,3]`
複数拠点取得

**説明:** 指定されたIDの複数拠点情報を一括取得します。

**認証:** 不要

**クエリパラメータ:**
- `ids`: 必須、JSON配列形式の文字列（例: `[1,2,3]`）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "渋谷拠点"
    },
    {
      "id": 2,
      "name": "新宿拠点"
    }
  ]
}
```

**エラーケース:**
- 400: パラメータ形式エラー
- 500: サーバーエラー

#### POST `/api/satellites`
拠点作成

**説明:** 新しい拠点を作成します。拠点トークンは自動生成され、契約タイプに応じて有効期限が設定されます。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**バリデーション:**
- `company_id`: 必須、整数
- `name`: 必須、文字列（1-255文字）
- `address`: オプション、文字列
- `phone`: オプション、文字列（最大20文字）
- `office_type_id`: オプション、整数
- `contract_type`: 必須、ENUM（'30days', '90days', '1year'）
- `max_users`: 必須、整数（デフォルト: 10）

**リクエスト:**
```json
{
  "company_id": 1,
  "name": "渋谷拠点",
  "address": "東京都渋谷区...",
  "phone": "03-1234-5678",
  "office_type_id": 1,
  "contract_type": "30days",
  "max_users": 50
}
```

**レスポンス（成功）:**
- **ステータスコード:** 201
```json
{
  "success": true,
  "message": "拠点が作成されました",
  "data": {
    "id": 1,
    "company_id": 1,
    "name": "渋谷拠点",
    "token": "SATE-0001-0001",
    "contract_type": "30days",
    "max_users": 50,
    "token_issued_at": "2024-01-01T00:00:00.000Z",
    "token_expiry_at": "2024-02-01T00:00:00.000Z"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 500: サーバーエラー

#### PUT `/api/satellites/:id`
拠点更新

**説明:** 指定されたIDの拠点情報を更新します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `name`: オプション、文字列（1-255文字）
- `address`: オプション、文字列
- `phone`: オプション、文字列（最大20文字）
- `office_type_id`: オプション、整数
- `contract_type`: オプション、ENUM（'30days', '90days', '1year'）
- `max_users`: オプション、整数

**リクエスト:**
```json
{
  "name": "渋谷拠点（更新）",
  "max_users": 100
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "拠点情報が更新されました",
  "data": {
    "id": 1,
    "name": "渋谷拠点（更新）",
    "max_users": 100
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 404: 拠点が見つからない
- 500: サーバーエラー

#### DELETE `/api/satellites/:id`
拠点削除

**説明:** 指定されたIDの拠点を削除します。関連するユーザーとの整合性に注意が必要です。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "拠点が削除されました"
}
```

**エラーケース:**
- 404: 拠点が見つからない
- 500: サーバーエラー

#### GET `/api/satellites/:id/users`
拠点所属ユーザー一覧取得

**説明:** 指定された拠点に所属するユーザー一覧を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "name": "利用者1",
        "email": "user1@example.com",
        "login_code": "USER-0001-0001",
        "role": 1,
        "instructor_id": 4
      }
    ],
    "count": 1
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 拠点が見つからない
- 500: サーバーエラー

#### GET `/api/satellites/:id/instructors`
拠点指導員一覧取得

**説明:** 指定された拠点に所属する指導員一覧を取得します（専門分野情報含む）。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ、`satelliteId`として解釈）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "name": "指導員1",
      "email": "instructor1@example.com",
      "specializations": [
        {
          "id": 1,
          "specialization": "プログラミング"
        }
      ]
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 拠点が見つからない
- 500: サーバーエラー

#### GET `/api/satellites/:id/stats`
拠点統計情報取得

**説明:** 指定された拠点の統計情報（利用者数、進捗率など）を取得します。

**認証:** 不要

**パラメータ:**
- `id`: 必須、整数（URLパラメータ、`satelliteId`として解釈）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "totalUsers": 50,
    "activeUsers": 45,
    "totalInstructors": 5,
    "averageProgress": 65.5,
    "completedLessons": 120,
    "totalLessons": 200
  }
}
```

**エラーケース:**
- 404: 拠点が見つからない
- 500: サーバーエラー

#### GET `/api/satellites/:id/disabled-courses`
無効化コース一覧取得

**説明:** 指定された拠点で無効化されているコース一覧を取得します。

**認証:** 不要

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "disabled_course_ids": [5, 10]
  }
}
```

#### PUT `/api/satellites/:id/disabled-courses`
無効化コース一覧更新

**説明:** 指定された拠点の無効化コース一覧を更新（置換）します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `disabled_course_ids`: 必須、整数配列

**リクエスト:**
```json
{
  "disabled_course_ids": [5, 10, 15]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "無効化コース一覧が更新されました",
  "data": {
    "disabled_course_ids": [5, 10, 15]
  }
}
```

#### POST `/api/satellites/:id/regenerate-token`
拠点トークン再生成

**説明:** 指定された拠点のトークンを再生成します。契約タイプに応じて有効期限が設定されます。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `contract_type`: オプション、ENUM（'30days', '90days', '1year'）（指定しない場合は既存の契約タイプを使用）

**リクエスト:**
```json
{
  "contract_type": "90days"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "拠点トークンが再生成されました",
  "data": {
    "id": 1,
    "token": "SATE-0001-0002",
    "token_issued_at": "2024-01-02T00:00:00.000Z",
    "token_expiry_at": "2024-04-02T00:00:00.000Z"
  }
}
```

#### GET `/api/satellites/:id/users/count`
拠点所属ユーザー数取得

**説明:** 指定された拠点に所属するユーザー数を取得します。

**認証:** 不要

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "count": 50
}
```

#### GET `/api/satellites/:id/managers`
拠点管理者一覧取得

**説明:** 指定された拠点の管理者一覧を取得します。

**認証:** 不要

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
[
  {
    "id": 1,
    "name": "管理者1",
    "role": 5
  }
]
```

#### POST `/api/satellites/:id/managers`
拠点管理者追加

**説明:** 指定された拠点に管理者を追加します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `manager_id`: 必須、整数

**リクエスト:**
```json
{
  "manager_id": 1
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "管理者が追加されました"
}
```

#### DELETE `/api/satellites/:id/managers/:managerId`
拠点管理者削除

**説明:** 指定された拠点から管理者を削除します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）
- `managerId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "管理者が削除されました"
}
```

#### PUT `/api/satellites/:id/managers`
拠点管理者一括設定

**説明:** 指定された拠点の管理者を一括設定（置換）します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `manager_ids`: 必須、整数配列

**リクエスト:**
```json
{
  "manager_ids": [1, 2, 3]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "管理者が一括設定されました"
}
```

#### PUT `/api/satellites/:id/add-manager`
拠点管理者追加（別名）

**説明:** 指定された拠点に管理者を追加します（`/managers`エンドポイントの別名）。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `manager_id`: 必須、整数

**リクエスト:**
```json
{
  "manager_id": 1
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "管理者が追加されました",
  "data": {
    "satelliteId": 1,
    "managerId": 1
  }
}
```

### 4. ユーザー管理 (`/api/users`)

#### GET `/api/users`
利用者一覧取得

#### POST `/api/users/create`
利用者作成

**リクエスト:**
```json
{
  "name": "田中太郎",
  "email": "tanaka@example.com",
  "role": 1,
  "company_id": 1,
  "satellite_ids": [1, 2],
  "is_remote_user": false,
  "recipient_number": "1234567890"
}
```

#### POST `/api/users/bulk-create`
一括利用者追加

**リクエスト:**
```json
{
  "users": [
    {
      "name": "利用者1",
      "email": "user1@example.com",
      "role": 1,
      "company_id": 1,
      "satellite_ids": [1]
    },
    {
      "name": "利用者2",
      "email": "user2@example.com",
      "role": 1,
      "company_id": 1,
      "satellite_ids": [1]
    }
  ]
}
```

#### PUT `/api/users/:userId`
利用者更新

#### DELETE `/api/users/:userId`
利用者削除

#### POST `/api/users/:userId/reset-password`
パスワードリセット

#### POST `/api/users/:userId/change-password`
パスワード変更

**リクエスト:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

#### POST `/api/users/:userId/issue-temp-password`
一時パスワード発行

#### POST `/api/users/verify-temp-password`
一時パスワード検証

**説明:** 利用者の一時パスワードを検証します。認証成功後、アクセストークンとリフレッシュトークンを発行します。

**認証:** 不要

**バリデーション:**
- `loginCode`: 必須、文字列（14文字、形式: USER-XXXX-XXXX）
- `tempPassword`: 必須、文字列（一時パスワード形式）

**リクエスト:**
```json
{
  "loginCode": "USER-0001-0001",
  "tempPassword": "1234-5678"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "認証に成功しました",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": 1,
      "userName": "利用者1",
      "role": 1
    }
  }
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 400
```json
{
  "success": false,
  "message": "ログインコードとパスワードは必須です",
  "error": "MISSING_CREDENTIALS"
}
```

**エラーケース:**
- 400: バリデーションエラー（loginCode/tempPasswordが未指定）
- 400: 認証失敗（ログインコードまたはパスワードが間違っている、または一時パスワードが期限切れ）
- 500: サーバーエラー

#### GET `/api/users/:userId/satellites`
所属拠点一覧取得

#### POST `/api/users/:userId/satellites`
拠点追加

#### DELETE `/api/users/:userId/satellites/:satelliteId`
拠点削除

#### GET `/api/users/:userId/specializations`
指導員専門分野一覧取得

#### POST `/api/users/:userId/specializations`
専門分野追加

#### PUT `/api/users/:userId/specializations/:specializationId`
専門分野更新

#### DELETE `/api/users/:userId/specializations/:specializationId`
専門分野削除

**説明:** 指定された指導員の専門分野を削除します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `userId`: 必須、整数（URLパラメータ）
- `specializationId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "専門分野が削除されました"
}
```

**エラーケース:**
- 404: 専門分野が見つからない
- 500: サーバーエラー

#### GET `/api/users/satellite/:satelliteId/instructor-relations`
拠点内の利用者と担当指導員の関係取得

**説明:** 指定された拠点内の利用者と担当指導員の関係一覧を取得します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "userId": 1,
      "userName": "利用者1",
      "instructorId": 4,
      "instructorName": "指導員1"
    }
  ]
}
```

#### GET `/api/users/satellite/:satelliteId/available-instructors`
拠点内の利用可能な指導員一覧取得

**説明:** 指定された拠点内の利用可能な指導員一覧を取得します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "name": "指導員1",
      "email": "instructor1@example.com",
      "specializations": ["プログラミング", "デザイン"]
    }
  ]
}
```

#### PUT `/api/users/:userId/instructor`
個別利用者の担当指導員変更

**説明:** 指定された利用者の担当指導員を変更します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `userId`: 必須、整数（URLパラメータ）

**バリデーション:**
- `instructorId`: オプション、整数（nullの場合は担当指導員を解除）

**リクエスト:**
```json
{
  "instructorId": 4
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "担当指導員が更新されました"
}
```

#### PUT `/api/users/satellite/:satelliteId/bulk-instructor-assignment`
一括で利用者の担当指導員を変更

**説明:** 指定された拠点内の複数利用者の担当指導員を一括変更します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**バリデーション:**
- `assignments`: 必須、配列
  - `userId`: 必須、整数
  - `instructorId`: オプション、整数（nullの場合は担当指導員を解除）

**リクエスト:**
```json
{
  "assignments": [
    {
      "userId": 1,
      "instructorId": 4
    },
    {
      "userId": 2,
      "instructorId": 5
    }
  ]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "担当指導員が一括更新されました",
  "data": {
    "updated": 2,
    "failed": 0
  }
}
```

#### DELETE `/api/users/satellite/:satelliteId/instructors`
拠点内の全利用者の担当指導員を一括削除

**説明:** 指定された拠点内の全利用者の担当指導員を一括削除します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "担当指導員が一括削除されました",
  "data": {
    "updated": 10
  }
}
```

#### GET `/api/users/satellite/:satelliteId/home-support-users`
在宅支援に追加可能な通所利用者一覧取得

**説明:** 指定された拠点内で在宅支援に追加可能な通所利用者一覧を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "利用者1",
      "is_remote_user": false
    }
  ]
}
```

#### GET `/api/users/satellite/:satelliteId/home-support-users-list`
在宅支援利用者一覧取得

**説明:** 指定された拠点の在宅支援対象利用者一覧を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "利用者1",
      "is_remote_user": true,
      "recipient_number": "1234567890"
    }
  ]
}
```

#### GET `/api/users/satellite/:satelliteId/home-support-users-with-records`
在宅支援利用者一覧取得（日次記録含む）

**説明:** 指定された拠点の在宅支援対象利用者一覧を取得します（日次記録情報を含む）。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "利用者1",
      "is_remote_user": true,
      "dailyRecords": [
        {
          "date": "2024-01-01",
          "workContent": "プログラミング学習"
        }
      ]
    }
  ]
}
```

#### GET `/api/users/satellite/:satelliteId/home-support-instructors`
在宅支援担当指導員一覧取得

**説明:** 指定された拠点の在宅支援担当指導員一覧を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "name": "指導員1"
    }
  ]
}
```

#### POST `/api/users/bulk-update-home-support`
在宅支援フラグを一括更新

**説明:** 複数利用者の在宅支援フラグを一括更新します。

**認証:** 必須（JWTトークン）

**バリデーション:**
- `userIds`: 必須、整数配列
- `is_remote_user`: 必須、ブール値

**リクエスト:**
```json
{
  "userIds": [1, 2, 3],
  "is_remote_user": true
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "在宅支援フラグが一括更新されました",
  "data": {
    "updated": 3
  }
}
```

#### PUT `/api/users/:userId/remove-home-support`
在宅支援解除（単一利用者）

**説明:** 指定された利用者の在宅支援フラグを解除します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `userId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "在宅支援が解除されました"
}
```

#### POST `/api/users/bulk-add-tags`
ユーザーのタグを一括追加

**説明:** 複数ユーザーにタグを一括追加します。

**認証:** 必須（JWTトークン）

**バリデーション:**
- `userIds`: 必須、整数配列
- `tags`: 必須、文字列配列

**リクエスト:**
```json
{
  "userIds": [1, 2, 3],
  "tags": ["タグ1", "タグ2"]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "タグが一括追加されました"
}
```

#### DELETE `/api/users/:userId/tags/:tagName`
ユーザーのタグを削除

**説明:** 指定されたユーザーからタグを削除します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `userId`: 必須、整数（URLパラメータ）
- `tagName`: 必須、文字列（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "タグが削除されました"
}
```

#### GET `/api/users/tags/all`
全タグ一覧を取得

**説明:** システム内のすべてのタグ一覧を取得します。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    "タグ1",
    "タグ2",
    "タグ3"
  ]
}
```

#### GET `/api/users/:userId`
個別利用者情報の取得

**説明:** 指定されたIDの利用者詳細情報を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `userId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "利用者1",
    "email": "user1@example.com",
    "login_code": "USER-0001-0001",
    "role": 1,
    "company_id": 1,
    "satellite_ids": [1, 2],
    "is_remote_user": false,
    "instructor_id": 4
  }
}
```

#### POST `/api/users/:userId/mark-temp-password-used`
一時パスワードを使用済みにマーク

**説明:** ログアウト時に一時パスワードを使用済みにマークします。

**認証:** 不要

**パラメータ:**
- `userId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "一時パスワードが使用済みにマークされました"
}
```

#### POST `/api/users/update-login-codes`
ログインコード更新

**説明:** すべての利用者のログインコードを更新します。

**認証:** 不要（管理者のみアクセス可能な場合あり）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "ログインコードが更新されました",
  "data": {
    "updated": 100
  }
}
```

#### GET `/api/users/satellite/:satelliteId/weekly-evaluation-instructors`
週次評価用の指導員一覧取得

**説明:** 週次評価用の指導員一覧を取得します（在宅支援と同一ロジックを再利用）。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "name": "指導員1"
    }
  ]
}
```

#### GET `/api/users/satellite/:satelliteId/evaluation-status`
拠点の評価状況取得

**説明:** 指定された拠点の評価状況（週次・月次・日次）を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "weeklyEvaluations": 10,
    "monthlyEvaluations": 2,
    "dailyRecords": 30
  }
}
```

### 5. 管理者管理 (`/api/admins`)

#### GET `/api/admins`
管理者一覧取得

#### POST `/api/admins`
管理者作成

#### PUT `/api/admins/:adminId`
管理者更新

#### DELETE `/api/admins/:adminId`
管理者削除（論理削除）

#### POST `/api/admins/:adminId/restore`
管理者復元

#### DELETE `/api/admins/:adminId/permanent`
管理者物理削除

### 6. コース管理 (`/api/courses`)

#### GET `/api/courses`
コース一覧取得

#### GET `/api/courses/:id`
コース詳細取得

#### POST `/api/courses`
コース作成

**リクエスト:**
```json
{
  "title": "基礎プログラミング",
  "description": "プログラミングの基礎を学ぶコース",
  "category": "必修科目",
  "order_index": 1,
  "status": "active"
}
```

#### PUT `/api/courses/:id`
コース更新

#### DELETE `/api/courses/:id`
コース削除

#### PUT `/api/courses/order`
コース順序更新

### 7. レッスン管理 (`/api/lessons`)

#### GET `/api/lessons`
レッスン一覧取得

#### GET `/api/lessons/:id`
レッスン詳細取得

#### POST `/api/lessons`
レッスン作成（ファイルアップロード対応）

**リクエスト:**
```
Content-Type: multipart/form-data

{
  "title": "JavaScript基礎",
  "description": "JavaScriptの基本構文を学ぶ",
  "course_id": 1,
  "duration": "60分",
  "has_assignment": true,
  "file": <ファイル>
}
```

#### PUT `/api/lessons/:id`
レッスン更新

#### DELETE `/api/lessons/:id`
レッスン削除

#### GET `/api/lessons/:id/download`
レッスンファイルダウンロード

#### GET `/api/lessons/:id/files`
レッスンファイル一覧取得

### 8. 学習管理 (`/api/learning`)

#### GET `/api/learning/progress/:userId`
ユーザー進捗取得

#### GET `/api/learning/progress/:userId/course/:courseId`
コース進捗取得

#### PUT `/api/learning/progress/lesson`
レッスン進捗更新

#### GET `/api/learning/current-lesson`
現在受講中レッスン取得

#### POST `/api/learning/upload-assignment`
成果物アップロード

**説明:** レッスンの成果物（ZIPファイル）をアップロードします。S3に保存され、データベースに提出記録が保存されます。

**認証:** 必須（JWTトークン）

**Content-Type:** `multipart/form-data`

**バリデーション:**
- `lessonId`: 必須、整数（リクエストボディ）
- `file`: 必須、ZIPファイル（最大10MB）

**リクエスト:**
```
Content-Type: multipart/form-data

{
  "lessonId": 1,
  "file": <ZIPファイル>
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "成果物のアップロードが完了しました",
  "data": {
    "fileName": "2024_0101_120000.zip",
    "originalFileName": "assignment.zip",
    "fileSize": 1024000,
    "s3Key": "doc/COMP-0001-0001/SATE-0001-0001/USER-0001-0001/1/2024_0101_120000.zip",
    "lessonId": 1,
    "userId": 1
  }
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 400
```json
{
  "success": false,
  "message": "ZIPファイルのみアップロード可能です",
  "error": "INVALID_FILE_TYPE"
}
```

**エラーケース:**
- 400: バリデーションエラー（lessonIdが未指定、ファイルが未指定、ZIPファイル以外）
- 400: レッスンに課題が設定されていない
- 404: レッスンが見つからない
- 404: ユーザーアカウント、企業情報、拠点情報が見つからない
- 500: サーバーエラー（S3アップロード失敗など）

#### GET `/api/learning/lesson/:lessonId/uploaded-files`
アップロード済みファイル取得

**説明:** 指定されたレッスンにアップロード済みの成果物ファイル一覧を取得します（承認状態も含む）。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `lessonId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "2024_0101_120000.zip",
      "type": "other",
      "uploadDate": "2024-01-01T12:00:00.000Z",
      "status": "uploaded",
      "s3Key": "doc/COMP-0001-0001/SATE-0001-0001/USER-0001-0001/1/2024_0101_120000.zip",
      "curriculumName": "基礎プログラミング",
      "sessionNumber": 1,
      "instructorApproved": false,
      "instructorApprovedAt": null
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### DELETE `/api/learning/lesson/:lessonId/uploaded-files/:fileId`
アップロード済みファイル削除

**説明:** 指定された成果物ファイルを削除します。S3からも削除され、ファイルが0件になった場合は課題提出状況がfalseに戻ります。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `lessonId`: 必須、整数（URLパラメータ）
- `fileId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "ファイルが削除されました",
  "data": {
    "fileId": 1,
    "lessonId": 1,
    "assignmentStatusReset": true
  }
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 404
```json
{
  "success": false,
  "message": "ファイルが見つかりません"
}
```

**エラーケース:**
- 401: 認証エラー
- 404: ファイルが見つからない
- 500: サーバーエラー

#### GET `/api/learning/lesson/:lessonId/assignment-status`
課題提出状況確認

**説明:** 指定されたレッスンの課題提出状況を確認します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `lessonId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "hasAssignment": true,
    "assignmentSubmitted": true,
    "submittedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**レスポンス（課題なし）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "hasAssignment": false,
    "assignmentSubmitted": false
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 404: レッスンが見つからない
- 500: サーバーエラー

#### POST `/api/learning/extract-pdf-text`
PDFテキスト抽出

**説明:** S3に保存されたPDFファイルからテキストを抽出します。AI機能やテスト生成に使用されます。

**認証:** 必須（JWTトークン）

**バリデーション:**
- `s3Key`: 必須、文字列（S3キー）
- `lessonId`: オプション、整数

**リクエスト:**
```json
{
  "s3Key": "doc/COMP-0001-0001/SATE-0001-0001/lesson1.pdf",
  "lessonId": 1
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "textContent": "抽出されたテキスト内容...",
  "lessonId": 1,
  "extractedAt": "2024-01-01T12:00:00.000Z",
  "processingTime": 5000,
  "requestId": "pdf-extract-1234567890-abc123"
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 404
```json
{
  "success": false,
  "message": "指定されたPDFファイルが見つかりません",
  "error": "The specified key does not exist.",
  "s3Key": "doc/COMP-0001-0001/SATE-0001-0001/lesson1.pdf",
  "requestId": "pdf-extract-1234567890-abc123"
}
```

**エラーケース:**
- 400: バリデーションエラー（s3Keyが未指定）
- 404: S3ファイルが見つからない
- 408: リクエストタイムアウト（15分）
- 413: PDFファイルサイズが大きすぎる（100MB制限）
- 500: サーバーエラー（PDF処理エラーなど）

**制限事項:**
- ファイルサイズ: 最大100MB
- 処理時間: 最大15分（リクエストタイムアウト）
- テキスト長: 最大1MB（抽出されたテキストが長すぎる場合は切り詰め）

#### GET `/api/learning/pdf-viewer`
PDFビューアー用エンドポイント

**説明:** S3に保存されたPDFファイルを取得して表示します。

**認証:** 不要（ただし、認証が必要な場合あり）

**クエリパラメータ:**
- `key`: 必須、文字列（S3キー）

**レスポンス（成功）:**
- **ステータスコード:** 200
- **Content-Type:** `application/pdf`
- **Content-Disposition:** `inline`
- **Body:** PDFファイルのバイナリデータ

**レスポンス（失敗）:**
- **ステータスコード:** 404
```json
{
  "success": false,
  "message": "指定されたPDFファイルが見つかりません",
  "error": "File not found in S3"
}
```

**エラーケース:**
- 400: バリデーションエラー（keyが未指定）
- 403: S3アクセスが拒否されました
- 404: ファイルが見つからない
- 500: サーバーエラー

#### POST `/api/learning/test/submit`
テスト結果提出

#### GET `/api/learning/test/results/:userId`
テスト結果取得

#### POST `/api/learning/approve-completion`
指導員承認

#### GET `/api/learning/lesson/:lessonId/content`
レッスンコンテンツ取得

#### POST `/api/learning/assign-course`
利用者とコースの関連付け

#### GET `/api/learning/certificate/:userId/:lessonId`
合格証明書取得

#### GET `/api/learning/certificates/:userId`
利用者証明書一覧取得

### 9. AI機能 (`/api/ai`)

**注意:** AI機能は環境変数`OPENAI_API_KEY`が設定されている場合のみ利用可能です。設定されていない場合は503エラーが返されます。

#### POST `/api/ai/assist`
AIアシスタント

**説明:** AIを使用して学習に関する質問に回答します。レッスンのコンテキストを使用してより適切な回答を生成します。

**認証:** 必須（JWTトークン）

**バリデーション:**
- `question`: 必須、文字列
- `context`: オプション、文字列（レッスンのテキスト内容）
- `lessonTitle`: オプション、文字列
- `model`: オプション、文字列（デフォルト: 'gpt-4o'）
- `maxTokens`: オプション、整数（デフォルト: 1000）
- `temperature`: オプション、数値（デフォルト: 0.3）
- `lessonId`: オプション、整数

**リクエスト:**
```json
{
  "question": "JavaScriptの変数宣言について教えてください",
  "context": "レッスンのテキスト内容...",
  "lessonTitle": "JavaScript基礎",
  "model": "gpt-4o",
  "maxTokens": 1000,
  "temperature": 0.3,
  "lessonId": 1
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "answer": "JavaScriptの変数宣言にはvar、let、constの3つのキーワードが使用されます...",
  "usage": {
    "promptTokens": 500,
    "completionTokens": 200,
    "totalTokens": 700
  }
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 503
```json
{
  "success": false,
  "message": "AI機能は現在この環境では利用できません",
  "error": "AI_FEATURE_DISABLED"
}
```

**エラーケース:**
- 400: バリデーションエラー（questionが未指定）
- 401: 認証エラー
- 503: AI機能が無効（OPENAI_API_KEYが設定されていない）
- 500: サーバーエラー（OpenAI APIエラーなど）

**注意事項:**
- OpenAI APIのトークン消費量に注意が必要です
- レッスンIDが指定されている場合、レッスンのコンテキストが自動的に取得されます

#### GET `/api/ai/status`
AI機能状態確認

**説明:** AI機能の利用可能状態を確認します。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "enabled": true,
  "model": "gpt-4o",
  "message": "AI機能は利用可能です"
}
```

**レスポンス（無効）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "enabled": false,
  "message": "AI機能は無効です（OPENAI_API_KEYが設定されていません）"
}
```

#### GET `/api/ai/section-text/:lessonId`
セクションテキスト取得

**説明:** 指定されたレッスンのセクションテキストを取得します。PDFの場合はテキストに変換されます。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `lessonId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "textContent": "レッスンのテキスト内容...",
  "lessonId": 1,
  "fileType": "pdf"
}
```

**エラーケース:**
- 401: 認証エラー
- 404: レッスンが見つからない
- 500: サーバーエラー（PDF処理エラーなど）

#### GET `/api/ai/pdf-status/:userId`
PDF処理状態確認

**説明:** 指定されたユーザーのPDF処理状態を確認します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `userId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "processing": false,
    "processed": true,
    "lastProcessedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 404: ユーザーが見つからない
- 500: サーバーエラー

### 10. ダッシュボード (`/api/dashboard`)

#### GET `/api/dashboard`
ダッシュボード概要取得

#### GET `/api/dashboard/overview`
システム概要取得

#### GET `/api/dashboard/company/:id`
企業統計取得

#### GET `/api/dashboard/alerts`
アラート一覧取得

### 11. ログ管理 (`/api/logs`)

#### GET `/api/logs`
ログファイル一覧取得

#### GET `/api/logs/:filename`
ログ内容取得

#### GET `/api/logs/:filename/download`
ログファイルダウンロード

#### DELETE `/api/logs/:filename`
ログファイル削除

#### POST `/api/logs/cleanup`
古いログクリーンアップ

#### GET `/api/logs/stats`
ログ統計取得

### 12. 操作ログ (`/api/operation-logs`)

#### GET `/api/operation-logs`
操作ログ一覧取得

#### GET `/api/operation-logs/stats`
操作ログ統計取得

#### GET `/api/operation-logs/export`
操作ログエクスポート

#### DELETE `/api/operation-logs`
操作ログクリア

### 13. 現在受講中レッスン管理 (`/api/current-lesson`)

#### GET `/api/current-lesson`
現在受講中レッスン取得

**説明:** 現在ログインしているユーザーが受講中のレッスン情報を取得します。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "course_id": 1,
    "lesson_id": 1,
    "lesson_title": "レッスン1",
    "course_title": "基礎プログラミング",
    "status": "active",
    "started_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**レスポンス（受講中レッスンなし）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": null
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### PUT `/api/current-lesson`
現在受講中レッスン更新

**説明:** 現在受講中のレッスン情報を更新します。

**認証:** 必須（JWTトークン）

**バリデーション:**
- `course_id`: 必須、整数
- `lesson_id`: 必須、整数

**リクエスト:**
```json
{
  "course_id": 1,
  "lesson_id": 2
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "現在受講中レッスンが更新されました",
  "data": {
    "user_id": 1,
    "course_id": 1,
    "lesson_id": 2,
    "status": "active"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（course_id/lesson_idが未指定）
- 401: 認証エラー
- 404: コースまたはレッスンが見つからない
- 500: サーバーエラー

#### PUT `/api/current-lesson/:courseId/pause`
現在受講中レッスンの一時停止

**説明:** 指定されたコースの現在受講中レッスンを一時停止します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `courseId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "レッスンが一時停止されました",
  "data": {
    "user_id": 1,
    "course_id": 1,
    "lesson_id": 1,
    "status": "paused"
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 404: コースまたは現在受講中レッスンが見つからない
- 500: サーバーエラー

#### PUT `/api/current-lesson/:courseId/resume`
現在受講中レッスンの再開

**説明:** 指定されたコースの一時停止中のレッスンを再開します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `courseId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "レッスンが再開されました",
  "data": {
    "user_id": 1,
    "course_id": 1,
    "lesson_id": 1,
    "status": "active"
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 404: コースまたは現在受講中レッスンが見つからない
- 500: サーバーエラー

### 14. カリキュラムパス管理 (`/api/curriculum-paths`)

#### GET `/api/curriculum-paths`
カリキュラムパス一覧取得

**説明:** すべてのカリキュラムパス一覧を取得します。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "基礎プログラミングパス",
      "description": "プログラミングの基礎を学ぶパス",
      "courses": [
        {
          "id": 1,
          "title": "JavaScript基礎",
          "order_index": 1
        }
      ],
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/curriculum-paths/available-courses`
利用可能コース一覧取得

**説明:** カリキュラムパスに追加可能なコース一覧を取得します。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "JavaScript基礎",
      "description": "JavaScriptの基礎を学ぶ",
      "category": "必修科目",
      "status": "active"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/curriculum-paths/:id`
カリキュラムパス詳細取得

**説明:** 指定されたIDのカリキュラムパス詳細情報を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "基礎プログラミングパス",
    "description": "プログラミングの基礎を学ぶパス",
    "courses": [
      {
        "id": 1,
        "title": "JavaScript基礎",
        "order_index": 1
      }
    ],
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 404: カリキュラムパスが見つからない
- 500: サーバーエラー

#### POST `/api/curriculum-paths`
カリキュラムパス作成

**説明:** 新しいカリキュラムパスを作成します。

**認証:** 必須（JWTトークン、ロール5以上）

**バリデーション:**
- `name`: 必須、文字列
- `description`: オプション、文字列
- `courses`: オプション、整数配列（コースIDの配列）

**リクエスト:**
```json
{
  "name": "基礎プログラミングパス",
  "description": "プログラミングの基礎を学ぶパス",
  "courses": [1, 2, 3]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 201
```json
{
  "success": true,
  "message": "カリキュラムパスが作成されました",
  "data": {
    "id": 1,
    "name": "基礎プログラミングパス",
    "courses": [1, 2, 3]
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 500: サーバーエラー

#### PUT `/api/curriculum-paths/:id`
カリキュラムパス更新

**説明:** 指定されたIDのカリキュラムパス情報を更新します。

**認証:** 必須（JWTトークン、ロール5以上）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `name`: オプション、文字列
- `description`: オプション、文字列
- `courses`: オプション、整数配列（コースIDの配列）

**リクエスト:**
```json
{
  "name": "基礎プログラミングパス（更新）",
  "courses": [1, 2, 3, 4]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "カリキュラムパスが更新されました",
  "data": {
    "id": 1,
    "name": "基礎プログラミングパス（更新）",
    "courses": [1, 2, 3, 4]
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 404: カリキュラムパスが見つからない
- 500: サーバーエラー

#### DELETE `/api/curriculum-paths/:id`
カリキュラムパス削除

**説明:** 指定されたIDのカリキュラムパスを削除します。

**認証:** 必須（JWTトークン、ロール5以上）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "カリキュラムパスが削除されました"
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 404: カリキュラムパスが見つからない
- 500: サーバーエラー

### 15. 指導員専門分野管理 (`/api/instructors`)

#### GET `/api/instructors/:userId/specializations`
指導員専門分野一覧取得

**説明:** 指定された指導員の専門分野一覧を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `userId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 4,
      "specialization": "プログラミング",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 500: サーバーエラー

#### POST `/api/instructors/:userId/specializations`
指導員専門分野一括設定

**説明:** 指定された指導員の専門分野を一括設定します。既存の専門分野は削除され、新しい専門分野が設定されます。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `userId`: 必須、整数（URLパラメータ）

**バリデーション:**
- `specializations`: 必須、文字列配列

**リクエスト:**
```json
{
  "specializations": ["プログラミング", "データベース", "ネットワーク"]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "専門分野が設定されました",
  "data": {
    "user_id": 4,
    "specializations": ["プログラミング", "データベース", "ネットワーク"]
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（specializationsが未指定または配列でない）
- 401: 認証エラー
- 404: ユーザーが見つからない
- 500: サーバーエラー

#### DELETE `/api/instructors/:userId/specializations/:specializationId`
指導員専門分野削除

**説明:** 指定された指導員の専門分野を削除します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `userId`: 必須、整数（URLパラメータ）
- `specializationId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "専門分野が削除されました"
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 404: 専門分野が見つからない
- 500: サーバーエラー

#### POST `/api/instructors/:instructorId/set-manager/:satelliteId`
指導員を拠点管理者に設定

**説明:** 指定された指導員を指定された拠点の管理者に設定します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `instructorId`: 必須、整数（URLパラメータ）
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "指導員が拠点管理者に設定されました",
  "data": {
    "instructor_id": 4,
    "satellite_id": 1
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（instructorId/satelliteIdが未指定）
- 401: 認証エラー
- 404: 指導員または拠点が見つからない
- 500: サーバーエラー

#### POST `/api/instructors/:instructorId/remove-manager/:satelliteId`
指導員の拠点管理者権限を解除

**説明:** 指定された指導員の指定された拠点の管理者権限を解除します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `instructorId`: 必須、整数（URLパラメータ）
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "指導員の拠点管理者権限が解除されました",
  "data": {
    "instructor_id": 4,
    "satellite_id": 1
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（instructorId/satelliteIdが未指定）
- 401: 認証エラー
- 404: 指導員または拠点が見つからない
- 500: サーバーエラー

### 16. レッスンテキストファイル管理 (`/api/lesson-text-files`)

#### GET `/api/lesson-text-files/lesson/:lessonId`
レッスンの複数テキストファイル一覧取得

**説明:** 指定されたレッスンに関連する複数のテキストファイル一覧を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `lessonId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "lesson_id": 1,
      "file_name": "lesson1.pdf",
      "s3_key": "lessons/lesson1/lesson1.pdf",
      "file_type": "pdf",
      "file_size": 1024000,
      "order_index": 1,
      "created_at": "2024-01-01T00:00:00.000Z",
      "lesson_title": "レッスン1",
      "course_title": "基礎プログラミング"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### POST `/api/lesson-text-files`
複数テキストファイルアップロード

**説明:** レッスンに複数のテキストファイルをアップロードします。対応ファイル形式: PDF、TXT、MD、DOCX、PPTX。

**認証:** 必須（JWTトークン）

**Content-Type:** `multipart/form-data`

**バリデーション:**
- `file`: 必須、ファイル（最大50MB）
- `lessonId`: 必須、整数
- `order`: オプション、整数（順序、未指定の場合は自動設定）

**リクエスト:**
```
Content-Type: multipart/form-data

{
  "file": <ファイル>,
  "lessonId": 1,
  "order": 1
}
```

**レスポンス（成功）:**
- **ステータスコード:** 201
```json
{
  "success": true,
  "message": "テキストファイルがアップロードされました",
  "data": {
    "id": 1,
    "lesson_id": 1,
    "file_name": "lesson1.pdf",
    "s3_key": "lessons/lesson1/lesson1.pdf",
    "file_type": "pdf",
    "file_size": 1024000,
    "order_index": 1
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（ファイル未選択、lessonId未指定、サポートされていないファイル形式）
- 401: 認証エラー
- 404: レッスンが見つからない
- 500: サーバーエラー

#### DELETE `/api/lesson-text-files/:id`
複数テキストファイル削除

**説明:** 指定されたIDのテキストファイルを削除します。S3からもファイルが削除されます。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "テキストファイルが削除されました"
}
```

**エラーケース:**
- 401: 認証エラー
- 404: ファイルが見つからない
- 500: サーバーエラー

#### PUT `/api/lesson-text-files/:id/order`
複数テキストファイル順序更新

**説明:** 指定されたテキストファイルの表示順序を更新します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `order_index`: 必須、整数

**リクエスト:**
```json
{
  "order_index": 2
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "ファイルの順序が更新されました"
}
```

**エラーケース:**
- 400: バリデーションエラー（order_indexが未指定）
- 401: 認証エラー
- 404: ファイルが見つからない
- 500: サーバーエラー

#### PUT `/api/lesson-text-files/lesson/:lessonId/order`
複数テキストファイル一括順序更新

**説明:** 指定されたレッスンの複数テキストファイルの表示順序を一括更新します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `lessonId`: 必須、整数（URLパラメータ）

**バリデーション:**
- `files`: 必須、配列
  - `id`: 必須、整数
  - `order_index`: 必須、整数

**リクエスト:**
```json
{
  "files": [
    {
      "id": 1,
      "order_index": 1
    },
    {
      "id": 2,
      "order_index": 2
    }
  ]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "ファイルの順序が一括更新されました"
}
```

**エラーケース:**
- 400: バリデーションエラー（filesが配列でない、必須項目が不足）
- 401: 認証エラー
- 500: サーバーエラー

### 17. レッスンテキスト・動画リンク管理 (`/api/lesson-text-video-links`)

#### GET `/api/lesson-text-video-links/lesson/:lessonId`
テキストと動画の紐づけ取得

**説明:** 指定されたレッスンのテキストファイルと動画の紐づけ一覧を取得します。レッスンのs3_key（テキストファイル）に紐づいた動画を検索します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `lessonId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "lesson_id": 1,
      "text_file_key": "lessons/lesson1/lesson1.pdf",
      "video_id": 1,
      "link_order": 1,
      "video_title": "変数宣言の説明",
      "youtube_url": "https://youtube.com/watch?v=xxx",
      "video_description": "JavaScriptの変数宣言について説明します",
      "video_duration": 300,
      "thumbnail_url": "https://example.com/thumbnail.jpg",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 404: レッスンが見つからない
- 500: サーバーエラー

#### GET `/api/lesson-text-video-links/:id`
テキスト・動画リンク詳細取得

**説明:** 指定されたIDのテキスト・動画リンク詳細情報を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "id": 1,
    "lesson_id": 1,
    "text_file_key": "lessons/lesson1/lesson1.pdf",
    "video_id": 1,
    "link_order": 1,
    "video_title": "変数宣言の説明",
    "youtube_url": "https://youtube.com/watch?v=xxx"
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 404: リンクが見つからない
- 500: サーバーエラー

#### POST `/api/lesson-text-video-links`
テキストと動画の紐づけ作成

**説明:** テキストファイルと動画の紐づけを作成します。

**認証:** 必須（JWTトークン、ロール5以上）

**バリデーション:**
- `lesson_id`: 必須、整数
- `text_file_key`: 必須、文字列（S3キー）
- `video_id`: 必須、整数
- `link_order`: オプション、整数（デフォルト: 0）

**リクエスト:**
```json
{
  "lesson_id": 1,
  "text_file_key": "lessons/lesson1/lesson1.pdf",
  "video_id": 1,
  "link_order": 1
}
```

**レスポンス（成功）:**
- **ステータスコード:** 201
```json
{
  "success": true,
  "message": "テキストと動画の紐づけが作成されました",
  "data": {
    "id": 1,
    "lesson_id": 1,
    "text_file_key": "lessons/lesson1/lesson1.pdf",
    "video_id": 1,
    "link_order": 1
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 500: サーバーエラー

#### PUT `/api/lesson-text-video-links/:id`
テキスト・動画リンク更新

**説明:** 指定されたIDのテキスト・動画リンク情報を更新します。

**認証:** 必須（JWTトークン、ロール5以上）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `text_file_key`: オプション、文字列
- `video_id`: オプション、整数
- `link_order`: オプション、整数

**リクエスト:**
```json
{
  "link_order": 2
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "テキスト・動画リンクが更新されました",
  "data": {
    "id": 1,
    "link_order": 2
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 404: リンクが見つからない
- 500: サーバーエラー

#### DELETE `/api/lesson-text-video-links/:id`
テキスト・動画リンク削除

**説明:** 指定されたIDのテキスト・動画リンクを削除します。

**認証:** 必須（JWTトークン、ロール5以上）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "テキスト・動画リンクが削除されました"
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 404: リンクが見つからない
- 500: サーバーエラー

#### PUT `/api/lesson-text-video-links/order`
テキスト・動画リンク順序更新

**説明:** 複数のテキスト・動画リンクの表示順序を一括更新します。

**認証:** 必須（JWTトークン、ロール5以上）

**バリデーション:**
- `links`: 必須、配列
  - `id`: 必須、整数
  - `link_order`: 必須、整数

**リクエスト:**
```json
{
  "links": [
    {
      "id": 1,
      "link_order": 1
    },
    {
      "id": 2,
      "link_order": 2
    }
  ]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "テキスト・動画リンクの順序が更新されました"
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 500: サーバーエラー

#### POST `/api/lesson-text-video-links/bulk-upsert`
複数紐づけの一括作成・更新

**説明:** 複数のテキスト・動画リンクを一括作成または更新します（upsert処理）。

**認証:** 必須（JWTトークン、ロール5以上）

**バリデーション:**
- `lesson_id`: 必須、整数
- `text_file_key`: 必須、文字列
- `links`: 必須、配列
  - `id`: オプション、整数（指定されている場合は更新、指定されていない場合は作成）
  - `video_id`: 必須、整数
  - `link_order`: オプション、整数

**リクエスト:**
```json
{
  "lesson_id": 1,
  "text_file_key": "lessons/lesson1/lesson1.pdf",
  "links": [
    {
      "video_id": 1,
      "link_order": 1
    },
    {
      "id": 2,
      "video_id": 2,
      "link_order": 2
    }
  ]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "テキスト・動画リンクが一括作成・更新されました",
  "data": {
    "created": 1,
    "updated": 1
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 500: サーバーエラー

### 18. レッスン動画管理 (`/api/lesson-videos`)

#### GET `/api/lesson-videos/lesson/:lessonId`
レッスン動画一覧取得

**説明:** 指定されたレッスンに関連する動画一覧を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `lessonId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "lesson_id": 1,
      "title": "変数宣言の説明",
      "video_url": "https://example.com/video1.mp4",
      "order_index": 1,
      "duration": 300,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/lesson-videos/:id`
レッスン動画詳細取得

**説明:** 指定されたIDのレッスン動画詳細情報を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "id": 1,
    "lesson_id": 1,
    "title": "変数宣言の説明",
    "video_url": "https://example.com/video1.mp4",
    "order_index": 1,
    "duration": 300,
    "description": "JavaScriptの変数宣言について説明します",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 動画が見つからない
- 500: サーバーエラー

#### POST `/api/lesson-videos`
レッスン動画作成

**説明:** 新しいレッスン動画を作成します。

**認証:** 必須（JWTトークン、ロール5以上）

**バリデーション:**
- `lesson_id`: 必須、整数
- `title`: 必須、文字列
- `video_url`: 必須、文字列（動画URL）
- `order_index`: オプション、整数（デフォルト: 0）
- `duration`: オプション、整数（秒数）
- `description`: オプション、文字列

**リクエスト:**
```json
{
  "lesson_id": 1,
  "title": "変数宣言の説明",
  "video_url": "https://example.com/video1.mp4",
  "order_index": 1,
  "duration": 300,
  "description": "JavaScriptの変数宣言について説明します"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 201
```json
{
  "success": true,
  "message": "レッスン動画が作成されました",
  "data": {
    "id": 1,
    "lesson_id": 1,
    "title": "変数宣言の説明",
    "video_url": "https://example.com/video1.mp4",
    "order_index": 1
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 500: サーバーエラー

#### PUT `/api/lesson-videos/:id`
レッスン動画更新

**説明:** 指定されたIDのレッスン動画情報を更新します。

**認証:** 必須（JWTトークン、ロール5以上）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `title`: オプション、文字列
- `video_url`: オプション、文字列
- `order_index`: オプション、整数
- `duration`: オプション、整数
- `description`: オプション、文字列

**リクエスト:**
```json
{
  "title": "変数宣言の説明（更新）",
  "duration": 350
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "レッスン動画が更新されました",
  "data": {
    "id": 1,
    "title": "変数宣言の説明（更新）",
    "duration": 350
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 404: 動画が見つからない
- 500: サーバーエラー

#### DELETE `/api/lesson-videos/:id`
レッスン動画削除

**説明:** 指定されたIDのレッスン動画を削除します。

**認証:** 必須（JWTトークン、ロール5以上）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "レッスン動画が削除されました"
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 404: 動画が見つからない
- 500: サーバーエラー

#### PUT `/api/lesson-videos/order`
レッスン動画順序更新

**説明:** 複数のレッスン動画の表示順序を一括更新します。

**認証:** 必須（JWTトークン、ロール5以上）

**バリデーション:**
- `videos`: 必須、配列
  - `id`: 必須、整数
  - `order_index`: 必須、整数

**リクエスト:**
```json
{
  "videos": [
    {
      "id": 1,
      "order_index": 1
    },
    {
      "id": 2,
      "order_index": 2
    }
  ]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "レッスン動画の順序が更新されました"
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 500: サーバーエラー

#### POST `/api/lesson-videos/bulk-upsert`
複数動画の一括作成・更新

**説明:** 複数のレッスン動画を一括作成または更新します（upsert処理）。

**認証:** 必須（JWTトークン、ロール5以上）

**バリデーション:**
- `lesson_id`: 必須、整数
- `videos`: 必須、配列
  - `id`: オプション、整数（指定されている場合は更新、指定されていない場合は作成）
  - `title`: 必須、文字列
  - `video_url`: 必須、文字列
  - `order_index`: オプション、整数
  - `duration`: オプション、整数
  - `description`: オプション、文字列

**リクエスト:**
```json
{
  "lesson_id": 1,
  "videos": [
    {
      "title": "動画1",
      "video_url": "https://example.com/video1.mp4",
      "order_index": 1
    },
    {
      "id": 2,
      "title": "動画2（更新）",
      "video_url": "https://example.com/video2.mp4",
      "order_index": 2
    }
  ]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "レッスン動画が一括作成・更新されました",
  "data": {
    "created": 1,
    "updated": 1
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 500: サーバーエラー

### 19. 管理者拠点管理 (`/api/managers`)

#### GET `/api/managers/:managerId/satellites`
管理者が管理する拠点一覧取得

**説明:** 指定された管理者が管理する拠点一覧を取得します（後方互換のために維持）。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `managerId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "渋谷拠点",
      "company_id": 1,
      "company_name": "株式会社サンプル"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 管理者が見つからない
- 500: サーバーエラー

### 20. 事業所タイプ管理 (`/api/office-types`)

#### GET `/api/office-types`
事業所タイプ一覧取得

**説明:** すべての事業所タイプ一覧を取得します。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "就労継続支援A型",
      "description": "就労継続支援A型事業所",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### POST `/api/office-types`
事業所タイプ作成

**説明:** 新しい事業所タイプを作成します。

**認証:** 必須（JWTトークン）

**バリデーション:**
- `name`: 必須、文字列
- `description`: オプション、文字列

**リクエスト:**
```json
{
  "name": "就労継続支援A型",
  "description": "就労継続支援A型事業所"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 201
```json
{
  "success": true,
  "message": "事業所タイプが作成されました",
  "data": {
    "id": 1,
    "name": "就労継続支援A型",
    "description": "就労継続支援A型事業所"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 500: サーバーエラー

#### DELETE `/api/office-types/:id`
事業所タイプ削除

**説明:** 指定されたIDの事業所タイプを削除します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "事業所タイプが削除されました"
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 404: 事業所タイプが見つからない
- 500: サーバーエラー

### 21. PDF処理管理 (`/api/pdf`)

#### GET `/api/pdf/health`
PDF処理APIヘルスチェック

**説明:** PDF処理APIの稼働状態を確認します。

**認証:** 不要

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "service": "pdf-processing"
}
```

#### POST `/api/pdf/upload`
PDFファイルアップロード・処理開始

**説明:** PDFファイルをアップロードし、テキスト抽出処理を開始します。非同期処理として実行されます。

**認証:** 必須（JWTトークン）

**Content-Type:** `multipart/form-data`

**バリデーション:**
- `file`: 必須、PDFファイル（最大100MB）
- `userId`: 必須、整数
- `lessonId`: オプション、整数

**リクエスト:**
```
Content-Type: multipart/form-data

{
  "file": <PDFファイル>,
  "userId": 1,
  "lessonId": 1
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "PDF処理が開始されました",
  "data": {
    "processId": "pdf-process-1234567890-abc123",
    "userId": 1,
    "lessonId": 1,
    "status": "processing",
    "startedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（ファイルが未指定、PDFファイル以外、ファイルサイズ超過）
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/pdf/status/:processId`
PDF処理状態確認

**説明:** 指定された処理IDのPDF処理状態を確認します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `processId`: 必須、文字列（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "processId": "pdf-process-1234567890-abc123",
    "status": "completed",
    "progress": 100,
    "startedAt": "2024-01-01T12:00:00.000Z",
    "completedAt": "2024-01-01T12:05:00.000Z"
  }
}
```

**ステータス値:**
- `pending`: 処理待ち
- `processing`: 処理中
- `completed`: 完了
- `failed`: 失敗
- `cancelled`: キャンセル済み

**エラーケース:**
- 401: 認証エラー
- 404: 処理が見つからない
- 500: サーバーエラー

#### GET `/api/pdf/user-status`
ユーザーのPDF処理状態一覧取得

**説明:** 現在のユーザーのPDF処理状態一覧を取得します。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "processId": "pdf-process-1234567890-abc123",
      "lessonId": 1,
      "status": "completed",
      "startedAt": "2024-01-01T12:00:00.000Z",
      "completedAt": "2024-01-01T12:05:00.000Z"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/pdf/result/:processId`
PDF処理結果取得

**説明:** 指定された処理IDのPDF処理結果（抽出されたテキスト）を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `processId`: 必須、文字列（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "processId": "pdf-process-1234567890-abc123",
    "status": "completed",
    "textContent": "抽出されたテキスト内容...",
    "pageCount": 10,
    "processingTime": 5000,
    "completedAt": "2024-01-01T12:05:00.000Z"
  }
}
```

**レスポンス（処理中）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "processId": "pdf-process-1234567890-abc123",
    "status": "processing",
    "progress": 50,
    "message": "処理中です。しばらくお待ちください。"
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 処理が見つからない
- 500: サーバーエラー

#### GET `/api/pdf/stats`
PDF処理統計取得（管理者用）

**説明:** PDF処理の統計情報を取得します（管理者用）。

**認証:** 必須（JWTトークン、ロール5以上）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "totalProcesses": 100,
    "completedProcesses": 95,
    "failedProcesses": 3,
    "processingProcesses": 2,
    "averageProcessingTime": 5000
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール5未満）
- 500: サーバーエラー

#### POST `/api/pdf/cancel/:processId`
PDF処理キャンセル

**説明:** 指定された処理IDのPDF処理をキャンセルします。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `processId`: 必須、文字列（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "PDF処理がキャンセルされました",
  "data": {
    "processId": "pdf-process-1234567890-abc123",
    "status": "cancelled"
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 処理が見つからない
- 400: 処理が既に完了またはキャンセル済み
- 500: サーバーエラー

### 22. 個別支援計画管理 (`/api/support-plans`)

#### GET `/api/support-plans`
個別支援計画一覧取得

**説明:** すべての個別支援計画一覧を取得します。

**認証:** 必須（JWTトークン）

**クエリパラメータ:**
- `userId`: オプション、整数（特定ユーザーの支援計画のみ取得）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "user_name": "利用者1",
      "plan_content": "個別支援計画の内容...",
      "target_period_start": "2024-01-01",
      "target_period_end": "2024-12-31",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/support-plans/user/:userId`
特定ユーザーの個別支援計画取得

**説明:** 指定されたユーザーの個別支援計画を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `userId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "user_name": "利用者1",
    "plan_content": "個別支援計画の内容...",
    "target_period_start": "2024-01-01",
    "target_period_end": "2024-12-31",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 支援計画が見つからない
- 500: サーバーエラー

#### POST `/api/support-plans`
個別支援計画作成

**説明:** 新しい個別支援計画を作成します。

**認証:** 必須（JWTトークン）

**バリデーション:**
- `user_id`: 必須、整数
- `plan_content`: 必須、文字列
- `target_period_start`: オプション、文字列（YYYY-MM-DD形式）
- `target_period_end`: オプション、文字列（YYYY-MM-DD形式）

**リクエスト:**
```json
{
  "user_id": 1,
  "plan_content": "個別支援計画の内容...",
  "target_period_start": "2024-01-01",
  "target_period_end": "2024-12-31"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 201
```json
{
  "success": true,
  "message": "個別支援計画が作成されました",
  "data": {
    "id": 1,
    "user_id": 1,
    "plan_content": "個別支援計画の内容...",
    "target_period_start": "2024-01-01",
    "target_period_end": "2024-12-31"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 404: ユーザーが見つからない
- 500: サーバーエラー

#### PUT `/api/support-plans/:id`
個別支援計画更新

**説明:** 指定されたIDの個別支援計画を更新します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `plan_content`: オプション、文字列
- `target_period_start`: オプション、文字列（YYYY-MM-DD形式）
- `target_period_end`: オプション、文字列（YYYY-MM-DD形式）

**リクエスト:**
```json
{
  "plan_content": "個別支援計画の内容（更新）...",
  "target_period_end": "2025-12-31"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "個別支援計画が更新されました",
  "data": {
    "id": 1,
    "plan_content": "個別支援計画の内容（更新）...",
    "target_period_end": "2025-12-31"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 404: 支援計画が見つからない
- 500: サーバーエラー

#### DELETE `/api/support-plans/:id`
個別支援計画削除

**説明:** 指定されたIDの個別支援計画を削除します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "個別支援計画が削除されました"
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 支援計画が見つからない
- 500: サーバーエラー

#### POST `/api/support-plans/upsert`
個別支援計画作成または更新（upsert）

**説明:** 個別支援計画を作成または更新します（upsert処理）。ユーザーIDが一致する支援計画が存在する場合は更新、存在しない場合は作成されます。

**認証:** 必須（JWTトークン）

**バリデーション:**
- `user_id`: 必須、整数
- `plan_content`: 必須、文字列
- `target_period_start`: オプション、文字列（YYYY-MM-DD形式）
- `target_period_end`: オプション、文字列（YYYY-MM-DD形式）

**リクエスト:**
```json
{
  "user_id": 1,
  "plan_content": "個別支援計画の内容...",
  "target_period_start": "2024-01-01",
  "target_period_end": "2024-12-31"
}
```

**レスポンス（作成時）:**
- **ステータスコード:** 201
```json
{
  "success": true,
  "message": "個別支援計画が作成されました",
  "data": {
    "id": 1,
    "user_id": 1,
    "action": "created"
  }
}
```

**レスポンス（更新時）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "個別支援計画が更新されました",
  "data": {
    "id": 1,
    "user_id": 1,
    "action": "updated"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 404: ユーザーが見つからない
- 500: サーバーエラー

### 23. 一時パスワード管理 (`/api/temp-passwords`)

#### GET `/api/temp-passwords/instructors`
指導員一覧取得

**説明:** 一時パスワード発行対象の指導員一覧を取得します。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "name": "指導員1",
      "email": "instructor1@example.com",
      "login_code": "INST-0001-0001"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/temp-passwords/users`
一時パスワード対象利用者一覧取得

**説明:** 一時パスワード発行対象の利用者一覧を取得します。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "利用者1",
      "login_code": "USER-0001-0001",
      "hasTempPassword": false,
      "tempPasswordExpiresAt": null
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/temp-passwords/hierarchy`
企業・拠点・担当者の階層構造取得

**説明:** 企業・拠点・担当者の階層構造を取得します（一時パスワード発行画面のフィルター用）。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "companies": [
      {
        "id": 1,
        "name": "株式会社サンプル",
        "satellites": [
          {
            "id": 1,
            "name": "渋谷拠点",
            "instructors": [
              {
                "id": 4,
                "name": "指導員1"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/temp-passwords/users-by-hierarchy`
選択された企業・拠点・担当者に基づいて利用者を取得

**説明:** 選択された企業・拠点・担当者に基づいて利用者一覧を取得します。

**認証:** 必須（JWTトークン）

**クエリパラメータ:**
- `companyId`: オプション、整数
- `satelliteId`: オプション、整数
- `instructorId`: オプション、整数

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "利用者1",
      "login_code": "USER-0001-0001",
      "company_id": 1,
      "satellite_ids": [1],
      "instructor_id": 4
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### POST `/api/temp-passwords/issue`
一時パスワードを一括発行

**説明:** 複数の利用者に対して一時パスワードを一括発行します。有効期限は日本時間の翌日24:30（翌日の0:30）に設定されます。

**認証:** 必須（JWTトークン）

**バリデーション:**
- `userIds`: 必須、整数配列

**リクエスト:**
```json
{
  "userIds": [1, 2, 3]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "一時パスワードが一括発行されました",
  "data": {
    "issued": 3,
    "failed": 0,
    "tempPasswords": [
      {
        "userId": 1,
        "loginCode": "USER-0001-0001",
        "tempPassword": "1234-5678",
        "expiresAt": "2024-01-02T00:30:00.000Z"
      }
    ]
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（userIdsが未指定または空配列）
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/temp-passwords/list`
一時パスワード一覧取得

**説明:** 発行済みの一時パスワード一覧を取得します。

**認証:** 必須（JWTトークン）

**クエリパラメータ:**
- `userId`: オプション、整数（特定ユーザーの一時パスワードのみ取得）
- `includeExpired`: オプション、ブール値（期限切れを含むかどうか、デフォルト: false）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "login_code": "USER-0001-0001",
      "temp_password": "1234-5678",
      "issued_at": "2024-01-01T12:00:00.000Z",
      "expires_at": "2024-01-02T00:30:00.000Z",
      "is_used": false,
      "used_at": null
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/temp-passwords/status/:login_code`
一時パスワード状態確認（認証不要）

**説明:** 指定されたログインコードの一時パスワード状態を確認します（認証不要）。

**認証:** 不要

**パラメータ:**
- `login_code`: 必須、文字列（URLパラメータ、形式: USER-XXXX-XXXX）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "hasTempPassword": true,
    "isExpired": false,
    "isUsed": false,
    "expiresAt": "2024-01-02T00:30:00.000Z",
    "issuedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**レスポンス（一時パスワードなし）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "hasTempPassword": false,
    "isExpired": false,
    "isUsed": false,
    "expiresAt": null,
    "issuedAt": null
  }
}
```

**エラーケース:**
- 404: ログインコードが見つからない
- 500: サーバーエラー

### 24. テスト・学習効果管理 (`/api/test`)

#### GET `/api/test/health`
ヘルスチェック

**説明:** テストAPIの稼働状態を確認します。

**認証:** 不要

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "service": "curriculum-portal-backend"
}
```

#### POST `/api/test/courses`
テスト用コース作成

**説明:** テスト用のコースを作成します。

**認証:** 不要（テスト用）

**バリデーション:**
- `title`: 必須、文字列
- `description`: オプション、文字列

**リクエスト:**
```json
{
  "title": "テストコース",
  "description": "テスト用のコースです"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 201
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "テストコース"
  }
}
```

#### GET `/api/test/courses`
テスト用コース一覧取得

**説明:** テスト用のコース一覧を取得します。

**認証:** 不要（テスト用）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "テストコース"
    }
  ]
}
```

#### GET `/api/test/learning/extract-text/:s3Key`
テキスト抽出API（テスト生成用）

**説明:** S3に保存されたファイル（PDF/テキスト）からテキストを抽出します（テスト生成用）。

**認証:** 不要（テスト用）

**パラメータ:**
- `s3Key`: 必須、文字列（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "text": "抽出されたテキスト内容...",
    "s3Key": "doc/lesson1.pdf",
    "processingTime": 1000
  }
}
```

**エラーケース:**
- 404: ファイルが見つからない
- 500: サーバーエラー（PDF処理エラーなど）

#### POST `/api/test/learning/generate-test`
学習効果テスト生成API

**説明:** AIを使用して学習効果テストを生成します。

**認証:** 不要（テスト用、ただし認証が必要な場合あり）

**バリデーション:**
- `type`: 必須、文字列（テストタイプ）
- `lessonId`: 必須、整数
- `sectionIndex`: オプション、整数
- `sectionTitle`: オプション、文字列
- `sectionDescription`: オプション、文字列
- `lessonTitle`: 必須、文字列
- `lessonDescription`: オプション、文字列
- `textContent`: 必須、文字列（テキストコンテンツ）
- `fileType`: オプション、文字列（'pdf', 'md', 'txt'など）
- `fileName`: オプション、文字列
- `questionCount`: オプション、整数（デフォルト: 5）

**リクエスト:**
```json
{
  "type": "multiple_choice",
  "lessonId": 1,
  "sectionIndex": 0,
  "sectionTitle": "変数宣言",
  "lessonTitle": "JavaScript基礎",
  "textContent": "JavaScriptの変数宣言について...",
  "fileType": "pdf",
  "fileName": "lesson1.pdf",
  "questionCount": 5
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "id": 1,
        "question": "JavaScriptの変数宣言に使用されるキーワードは？",
        "options": ["var", "let", "const", "すべて"],
        "correctAnswer": "すべて",
        "explanation": "JavaScriptではvar、let、constの3つのキーワードが使用されます"
      }
    ],
    "lessonId": 1,
    "sectionIndex": 0
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（必須パラメータが未指定、textContentが空）
- 500: サーバーエラー（OpenAI APIエラーなど）

#### POST `/api/test/learning/generate-feedback`
フィードバック生成API

**説明:** AIを使用してテストの誤答に対するフィードバックを生成します。

**認証:** 不要（テスト用、ただし認証が必要な場合あり）

**バリデーション:**
- `question`: 必須、文字列
- `userAnswer`: 必須、文字列
- `correctAnswer`: 必須、文字列
- `allOptions`: 必須、文字列配列

**リクエスト:**
```json
{
  "question": "JavaScriptの変数宣言に使用されるキーワードは？",
  "userAnswer": "var",
  "correctAnswer": "すべて",
  "allOptions": ["var", "let", "const", "すべて"]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "feedback": "varは正しい選択肢の一つですが、JavaScriptではvar、let、constの3つすべてが変数宣言に使用されます。それぞれの違いを理解することが重要です。次回はletとconstの違いについても学習しましょう。"
}
```

**エラーケース:**
- 400: バリデーションエラー（必須パラメータが未指定）
- 500: サーバーエラー（OpenAI APIエラーなど）

#### POST `/api/test/learning/test/submit`
テスト結果提出API（採点機能付き）

**説明:** テスト結果を提出し、自動採点を行います。認証トークンまたは一時パスワード認証が可能です。

**認証:** オプション（JWTトークンまたは一時パスワード認証）

**バリデーション:**
- `lessonId`: 必須、整数
- `answers`: 必須、配列
  - `questionId`: 必須、整数
  - `selectedAnswer`: 必須、文字列
- `loginCode`: オプション、文字列（一時パスワード認証の場合）
- `tempPassword`: オプション、文字列（一時パスワード認証の場合）

**リクエスト:**
```json
{
  "lessonId": 1,
  "answers": [
    {
      "questionId": 1,
      "selectedAnswer": "すべて"
    }
  ]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "テスト結果が提出されました",
  "data": {
    "testResultId": 1,
    "score": 80,
    "totalQuestions": 5,
    "correctAnswers": 4,
    "passed": true,
    "requiresApproval": true
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（必須パラメータが未指定）
- 401: 認証エラー（認証トークンまたは一時パスワードが無効）
- 500: サーバーエラー

#### GET `/api/test/instructor/student/:studentId/lesson-progress`
指導員用：利用者のレッスン進捗とテスト結果を取得

**説明:** 指定された利用者のレッスン進捗とテスト結果を取得します。

**認証:** 必須（JWTトークン、ロール4以上）

**パラメータ:**
- `studentId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "lessons": [
      {
        "lessonId": 1,
        "lessonTitle": "JavaScript基礎",
        "status": "completed",
        "testScore": 80,
        "testPassed": true,
        "testApproved": true,
        "assignmentSubmitted": true,
        "assignmentApproved": true
      }
    ]
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 404: 利用者が見つからない
- 500: サーバーエラー

#### POST `/api/test/instructor/student/:studentId/lesson/:lessonId/approve`
指導員用：レッスン完了の承認

**説明:** 指定された利用者のレッスン完了を承認します。

**認証:** 必須（JWTトークン、ロール4以上）

**パラメータ:**
- `studentId`: 必須、整数（URLパラメータ）
- `lessonId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "レッスン完了が承認されました",
  "data": {
    "studentId": 1,
    "lessonId": 1,
    "approvedAt": "2024-01-02T10:00:00.000Z"
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 404: 利用者またはレッスンが見つからない
- 500: サーバーエラー

#### GET `/api/test/instructor/pending-approvals`
指導員用：未承認の合格テスト結果を取得

**説明:** 指導員が承認待ちの合格テスト結果一覧を取得します。

**認証:** 必須（JWTトークン、ロール4以上）

**クエリパラメータ:**
- `satelliteId`: オプション、整数（拠点フィルタリング）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "testResultId": 1,
      "studentId": 1,
      "studentName": "利用者1",
      "lessonId": 1,
      "lessonTitle": "JavaScript基礎",
      "score": 80,
      "totalQuestions": 5,
      "submittedAt": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 500: サーバーエラー

#### POST `/api/test/instructor/approve-test`
指導員用：テスト合格承認

**説明:** 指定されたテスト結果を承認します。

**認証:** 必須（JWTトークン、ロール4以上）

**バリデーション:**
- `testResultId`: 必須、整数
- `studentId`: 必須、整数
- `lessonId`: 必須、整数
- `comment`: オプション、文字列

**リクエスト:**
```json
{
  "testResultId": 1,
  "studentId": 1,
  "lessonId": 1,
  "comment": "よく理解できています"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "テスト合格が承認されました",
  "data": {
    "testResultId": 1,
    "studentId": 1,
    "lessonId": 1,
    "approvedAt": "2024-01-02T10:00:00.000Z"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（必須パラメータが未指定）
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 404: テスト結果が見つからない
- 500: サーバーエラー

### 25. 利用者コース管理 (`/api/user-courses`)

#### GET `/api/user-courses/satellite/:satelliteId/user-courses`
拠点内の利用者のコース関連付け一覧取得

**説明:** 指定された拠点内の利用者のコース関連付け一覧を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "user_id": 1,
      "user_name": "利用者1",
      "course_id": 1,
      "course_title": "基礎プログラミング",
      "status": "active",
      "assigned_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 拠点が見つからない
- 500: サーバーエラー

#### GET `/api/user-courses/satellite/:satelliteId/available-courses`
拠点で利用可能なコース一覧取得

**説明:** 指定された拠点で利用可能なコース一覧を取得します。拠点で無効化されているコースは除外されます。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "基礎プログラミング",
      "description": "プログラミングの基礎を学ぶ",
      "category": "必修科目",
      "status": "active",
      "order_index": 1
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 拠点が見つからない
- 500: サーバーエラー

#### GET `/api/user-courses/satellite/:satelliteId/available-curriculum-paths`
拠点で利用可能なカリキュラムパス一覧取得

**説明:** 指定された拠点で利用可能なカリキュラムパス一覧を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "基礎プログラミングパス",
      "description": "プログラミングの基礎を学ぶパス",
      "courses": [
        {
          "id": 1,
          "title": "JavaScript基礎"
        }
      ]
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 拠点が見つからない
- 500: サーバーエラー

#### POST `/api/user-courses/satellite/:satelliteId/bulk-assign-courses`
利用者にコースを一括追加

**説明:** 指定された拠点内の複数利用者にコースを一括追加します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**バリデーション:**
- `userIds`: 必須、整数配列
- `courseIds`: 必須、整数配列

**リクエスト:**
```json
{
  "userIds": [1, 2, 3],
  "courseIds": [1, 2]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "コースが一括追加されました",
  "data": {
    "assigned": 6,
    "failed": 0
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（userIds/courseIdsが未指定または空配列）
- 401: 認証エラー
- 404: 拠点が見つからない
- 500: サーバーエラー

#### POST `/api/user-courses/satellite/:satelliteId/bulk-remove-courses`
利用者からコースを一括削除

**説明:** 指定された拠点内の複数利用者からコースを一括削除します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**バリデーション:**
- `userIds`: 必須、整数配列
- `courseIds`: 必須、整数配列

**リクエスト:**
```json
{
  "userIds": [1, 2, 3],
  "courseIds": [1, 2]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "コースが一括削除されました",
  "data": {
    "removed": 6,
    "failed": 0
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（userIds/courseIdsが未指定または空配列）
- 401: 認証エラー
- 404: 拠点が見つからない
- 500: サーバーエラー

#### POST `/api/user-courses/satellite/:satelliteId/bulk-assign-curriculum-paths`
利用者にカリキュラムパスを一括追加

**説明:** 指定された拠点内の複数利用者にカリキュラムパスを一括追加します。カリキュラムパスに含まれるすべてのコースが自動的に追加されます。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**バリデーション:**
- `userIds`: 必須、整数配列
- `curriculumPathIds`: 必須、整数配列

**リクエスト:**
```json
{
  "userIds": [1, 2, 3],
  "curriculumPathIds": [1, 2]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "カリキュラムパスが一括追加されました",
  "data": {
    "assigned": 6,
    "failed": 0,
    "coursesAssigned": 12
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（userIds/curriculumPathIdsが未指定または空配列）
- 401: 認証エラー
- 404: 拠点またはカリキュラムパスが見つからない
- 500: サーバーエラー

### 26. ユーザー名検証 (`/api/username`)

#### GET `/api/username/check/:username`
リアルタイムusername重複チェック

**説明:** 指定されたusernameの重複チェックを実行します。更新時は現在のユーザーIDを除外してチェックします。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `username`: 必須、文字列（URLパラメータ）

**バリデーション:**
- 文字種: 半角英数字、アンダースコア、ハイフン、スラッシュ、ドットのみ使用可能（正規表現: `/^[a-zA-Z0-9_/.-]+$/`）
- 長さ: 3文字以上50文字以下

**レスポンス（使用可能）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "available": true,
  "message": "このログインIDは使用可能です"
}
```

**レスポンス（使用不可）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "available": false,
  "message": "このログインIDは既に使用されています"
}
```

**レスポンス（バリデーションエラー）:**
- **ステータスコード:** 400
```json
{
  "success": false,
  "message": "ログインIDは半角英数字、アンダースコア、ハイフン、スラッシュ、ドットのみ使用可能です",
  "available": false
}
```

**エラーケース:**
- 400: バリデーションエラー（usernameが未指定、文字種エラー、長さエラー）
- 401: 認証エラー
- 500: サーバーエラー

#### POST `/api/username/check-bulk`
複数usernameの一括重複チェック

**説明:** 複数のusernameの重複チェックを一括実行します。最大100個まで一度にチェック可能です。

**認証:** 必須（JWTトークン）

**バリデーション:**
- `usernames`: 必須、文字列配列（最大100個）

**リクエスト:**
```json
{
  "usernames": ["admin001", "admin002", "admin003"]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "results": [
    {
      "username": "admin001",
      "available": false,
      "message": "このログインIDは既に使用されています"
    },
    {
      "username": "admin002",
      "available": true,
      "message": "このログインIDは使用可能です"
    },
    {
      "username": "admin003",
      "available": false,
      "message": "ログインIDは3文字以上50文字以下で入力してください"
    }
  ]
}
```

**エラーケース:**
- 400: バリデーションエラー（usernamesが配列でない、空配列、100個超過）
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/username/suggestions/:baseUsername`
利用可能なusername候補を提案

**説明:** 指定されたベースusernameから利用可能なusername候補を最大5個まで提案します。数字を追加した候補を生成します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `baseUsername`: 必須、文字列（URLパラメータ）

**バリデーション:**
- 文字種: 半角英数字、アンダースコア、ハイフン、スラッシュ、ドットのみ使用可能

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "suggestions": ["admin0011", "admin0012", "admin0013", "admin0014", "admin0015"],
  "message": "5個の利用可能な候補が見つかりました"
}
```

**レスポンス（候補なし）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "suggestions": [],
  "message": "利用可能な候補が見つかりませんでした"
}
```

**エラーケース:**
- 400: バリデーションエラー（baseUsernameが未指定、文字種エラー）
- 401: 認証エラー
- 500: サーバーエラー

### 27. 在宅支援管理 (`/api/remote-support`)

#### GET `/api/remote-support/health`
ヘルスチェック

**説明:** 在宅支援APIの稼働状態を確認します。

**認証:** 不要

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "Remote Support API is running",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### POST `/api/remote-support/upload-capture`
画像アップロード（カメラ・スクリーンショット）

**説明:** カメラで撮影した画像またはスクリーンショットをアップロードします。

**認証:** 不要（userTokenが必要な場合あり）

**Content-Type:** `multipart/form-data`

**バリデーション:**
- `photo`: オプション、画像ファイル（最大10MB）
- `screenshot`: オプション、画像ファイル（最大10MB）
- `userToken`: オプション、文字列

**リクエスト:**
```
Content-Type: multipart/form-data

{
  "photo": <画像ファイル>,
  "screenshot": <画像ファイル>,
  "userToken": "USER-0001-0001"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "画像がアップロードされました",
  "data": {
    "photoUrl": "https://s3.amazonaws.com/bucket/photo.jpg",
    "screenshotUrl": "https://s3.amazonaws.com/bucket/screenshot.jpg"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（ファイルサイズ超過など）
- 500: サーバーエラー

#### POST `/api/remote-support/mark-attendance`
勤怠打刻

**説明:** 在宅利用者の勤怠打刻を行います。

**認証:** 不要（userTokenが必要な場合あり）

**バリデーション:**
- `userToken`: 必須、文字列
- `markType`: 必須、文字列（'start', 'lunch_start', 'lunch_end', 'end'）

**リクエスト:**
```json
{
  "userToken": "USER-0001-0001",
  "markType": "start",
  "date": "2024-01-01"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "勤怠打刻が記録されました",
  "data": {
    "markTime": "2024-01-01T09:00:00.000Z"
  }
}
```

#### POST `/api/remote-support/login`
ログイン

**説明:** 在宅支援アプリからのログイン処理。

**認証:** 不要

**バリデーション:**
- `loginCode`: 必須、文字列
- `password`: 必須、文字列

**リクエスト:**
```json
{
  "loginCode": "USER-0001-0001",
  "password": "password123"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "ログインに成功しました",
  "data": {
    "userId": 1,
    "userName": "利用者1",
    "token": "USER-0001-0001"
  }
}
```

#### GET `/api/remote-support/check-temp-password/:loginCode`
一時パスワード監視

**説明:** 指定されたログインコードの一時パスワード状態を確認します。

**認証:** 不要

**パラメータ:**
- `loginCode`: 必須、文字列（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "hasTempPassword": true,
    "isExpired": false,
    "expiresAt": "2024-01-02T00:30:00.000Z"
  }
}
```

#### POST `/api/remote-support/auto-login`
自動ログイン

**説明:** 在宅支援アプリからの自動ログイン処理。

**認証:** 不要

**バリデーション:**
- `loginCode`: 必須、文字列
- `deviceId`: オプション、文字列

**リクエスト:**
```json
{
  "loginCode": "USER-0001-0001",
  "deviceId": "device-12345"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "自動ログインに成功しました",
  "data": {
    "userId": 1,
    "userName": "利用者1"
  }
}
```

#### POST `/api/remote-support/notify-temp-password`
一時パスワード通知受信

**説明:** 一時パスワード通知を受信します。

**認証:** 不要

**バリデーション:**
- `loginCode`: 必須、文字列
- `tempPassword`: 必須、文字列

**リクエスト:**
```json
{
  "loginCode": "USER-0001-0001",
  "tempPassword": "1234-5678"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "一時パスワード通知を受信しました"
}
```

#### GET `/api/remote-support/get-temp-password-notification/:loginCode`
一時パスワード通知取得

**説明:** 指定されたログインコードの一時パスワード通知を取得します。

**認証:** 不要

**パラメータ:**
- `loginCode`: 必須、文字列（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "tempPassword": "1234-5678",
    "expiresAt": "2024-01-02T00:30:00.000Z"
  }
}
```

#### POST `/api/remote-support/verify-user-code`
スクールモード用：利用者コード検証

**説明:** スクールモード用の利用者コード検証を行います。

**認証:** 不要

**バリデーション:**
- `userCode`: 必須、文字列

**リクエスト:**
```json
{
  "userCode": "USER-0001-0001"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "利用者コードが検証されました",
  "data": {
    "userId": 1,
    "userName": "利用者1"
  }
}
```

#### GET `/api/remote-support/daily-reports`
日報一覧取得

**説明:** 在宅利用者の日報一覧を取得します。日付フィルタリングが可能です。

**認証:** 必須（JWTトークン）

**クエリパラメータ:**
- `userId`: オプション、整数
- `startDate`: オプション、文字列（YYYY-MM-DD形式）
- `endDate`: オプション、文字列（YYYY-MM-DD形式）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "date": "2024-01-01",
      "workContent": "プログラミング学習",
      "workResult": "基礎を理解できた",
      "dailyReport": "今日はJavaScriptの基礎を学習しました",
      "supportContent": "質問に回答",
      "advice": "次回は実践問題に取り組みましょう",
      "created_at": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

**エラーケース:**
- 400: バリデーションエラー（userIdが未指定、日付フォーマットが無効、開始日が終了日より後）
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/remote-support/daily-reports/:id`
日報詳細取得

**説明:** 指定されたIDの日報詳細情報を取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "date": "2024-01-01",
    "mark_start": "2024-01-01T09:00:00.000Z",
    "mark_end": "2024-01-01T18:00:00.000Z",
    "workContent": "プログラミング学習",
    "workResult": "基礎を理解できた",
    "dailyReport": "今日はJavaScriptの基礎を学習しました",
    "supportContent": "質問に回答",
    "advice": "次回は実践問題に取り組みましょう",
    "instructor_comment": "よく頑張っています",
    "created_at": "2024-01-01T12:00:00.000Z"
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 日報が見つからない
- 500: サーバーエラー

#### PUT `/api/remote-support/daily-reports/:id`
日報更新

**説明:** 指定されたIDの日報内容を更新します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `workContent`: オプション、文字列
- `workResult`: オプション、文字列
- `dailyReport`: オプション、文字列
- `supportContent`: オプション、文字列
- `advice`: オプション、文字列

**リクエスト:**
```json
{
  "workContent": "プログラミング学習（更新）",
  "workResult": "応用問題も解けるようになった",
  "dailyReport": "今日は応用問題に取り組みました"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "日報が更新されました"
}
```

**エラーケース:**
- 401: 認証エラー
- 404: 日報が見つからない
- 500: サーバーエラー

#### POST `/api/remote-support/daily-reports/:id/comments`
日報コメント追加

**説明:** 指定された日報にコメント（指導員フィードバック）を追加します。

**認証:** 必須（JWTトークン、ロール4以上）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）

**バリデーション:**
- `comment`: 必須、文字列

**リクエスト:**
```json
{
  "comment": "よく頑張っています。次回は実践問題に取り組みましょう。"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "コメントが追加されました",
  "data": {
    "commentId": 1,
    "comment": "よく頑張っています。次回は実践問題に取り組みましょう。",
    "instructorId": 4,
    "createdAt": "2024-01-02T10:00:00.000Z"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（commentが未指定）
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 404: 日報が見つからない
- 500: サーバーエラー

#### DELETE `/api/remote-support/daily-reports/:id/comments/:commentId`
日報コメント削除

**説明:** 指定された日報のコメントを削除します。

**認証:** 必須（JWTトークン、ロール4以上）

**パラメータ:**
- `id`: 必須、整数（URLパラメータ）
- `commentId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "コメントが削除されました"
}
```

#### GET `/api/remote-support/capture-records`
S3記録データ取得

**説明:** S3に保存された記録データ（画像・スクリーンショット）の一覧を取得します。

**認証:** 必須（JWTトークン）

**クエリパラメータ:**
- `userId`: オプション、整数
- `date`: オプション、文字列（YYYY-MM-DD形式）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "photo_url": "https://s3.amazonaws.com/bucket/photo.jpg",
      "screenshot_url": "https://s3.amazonaws.com/bucket/screenshot.jpg",
      "uploaded_at": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

#### GET `/api/remote-support/capture-records/:userId/:date`
ユーザー・日付指定のS3記録データ取得

**説明:** 指定されたユーザーと日付のS3記録データを取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `userId`: 必須、整数（URLパラメータ）
- `date`: 必須、文字列（YYYY-MM-DD形式、URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "photo_url": "https://s3.amazonaws.com/bucket/photo.jpg",
      "uploaded_at": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

#### GET `/api/remote-support/daily-records`
日次記録一覧取得（週次評価用）

**説明:** 週次評価用の日次記録一覧を取得します。日付範囲でフィルタリング可能です。

**認証:** 必須（JWTトークン）

**クエリパラメータ:**
- `userId`: 必須、整数
- `startDate`: オプション、文字列（YYYY-MM-DD形式）
- `endDate`: オプション、文字列（YYYY-MM-DD形式）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "date": "2024-01-01",
      "startTime": "09:00",
      "endTime": "18:00",
      "supportMethod": "オンライン",
      "workContent": "プログラミング学習",
      "workResult": "基礎を理解できた",
      "dailyReport": "今日はJavaScriptの基礎を学習しました",
      "supportContent": "質問に回答",
      "advice": "次回は実践問題に取り組みましょう",
      "condition": "普通"
    }
  ]
}
```

**エラーケース:**
- 400: バリデーションエラー（userIdが未指定、日付フォーマットが無効、開始日が終了日より後）
- 401: 認証エラー
- 500: サーバーエラー（データベース接続エラーなど）

#### GET `/api/remote-support/daily-attendance/:satelliteId`
在宅支援利用者の日次勤怠データ取得（拠点・日付指定）

**説明:** 指定された拠点の在宅支援利用者の日次勤怠データを取得します。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**クエリパラメータ:**
- `date`: オプション、文字列（YYYY-MM-DD形式）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "user_id": 1,
      "user_name": "利用者1",
      "date": "2024-01-01",
      "mark_start": "2024-01-01T09:00:00.000Z",
      "mark_end": "2024-01-01T18:00:00.000Z"
    }
  ]
}
```

### 28. アナウンス管理 (`/api/announcements`)

#### GET `/api/announcements/user`
利用者用：アナウンス一覧取得

**説明:** 利用者向けのアナウンス一覧を取得します（未読・既読状態を含む）。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "システムメンテナンスのお知らせ",
      "content": "2024年1月10日にメンテナンスを実施します",
      "created_at": "2024-01-01T12:00:00.000Z",
      "is_read": false
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### PUT `/api/announcements/user/:announcement_id/read`
利用者用：アナウンスを既読にする

**説明:** 指定されたアナウンスを既読にマークします。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `announcement_id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "アナウンスを既読にしました"
}
```

**エラーケース:**
- 401: 認証エラー
- 404: アナウンスが見つからない
- 500: サーバーエラー

#### PUT `/api/announcements/user/read-all`
利用者用：全アナウンスを既読にする

**説明:** 現在のユーザーのすべてのアナウンスを既読にマークします。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "すべてのアナウンスを既読にしました"
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/announcements/admin`
管理者用：アナウンス一覧取得

**説明:** 管理者・指導員向けのアナウンス一覧を取得します。拠点フィルタリングが可能です。

**認証:** 必須（JWTトークン、ロール4以上）

**クエリパラメータ:**
- `satellite_id`: オプション、整数（拠点フィルタリング）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "システムメンテナンスのお知らせ",
      "content": "2024年1月10日にメンテナンスを実施します",
      "target_users": [1, 2, 3],
      "target_instructors": [4, 5],
      "created_at": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 500: サーバーエラー

#### GET `/api/announcements/admin/users`
管理者用：利用者一覧取得（アナウンス送信用）

**説明:** アナウンス送信用の利用者一覧を取得します。

**認証:** 必須（JWTトークン、ロール4以上）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "利用者1",
      "login_code": "USER-0001-0001"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 500: サーバーエラー

#### GET `/api/announcements/admin/instructors-for-filter`
管理者用：指導員一覧取得（フィルター用）

**説明:** アナウンス送信用の指導員一覧を取得します（フィルター用）。

**認証:** 必須（JWTトークン、ロール4以上）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "name": "指導員1"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 500: サーバーエラー

#### POST `/api/announcements/admin/create`
管理者用：アナウンス作成

**説明:** 新しいアナウンスを作成・送信します。

**認証:** 必須（JWTトークン、ロール4以上）

**バリデーション:**
- `title`: 必須、文字列
- `content`: 必須、文字列
- `target_users`: オプション、整数配列（送信対象の利用者ID）
- `target_instructors`: オプション、整数配列（送信対象の指導員ID）
- `satellite_ids`: オプション、整数配列（送信対象の拠点ID）

**リクエスト:**
```json
{
  "title": "システムメンテナンスのお知らせ",
  "content": "2024年1月10日にメンテナンスを実施します",
  "target_users": [1, 2, 3],
  "target_instructors": [4, 5],
  "satellite_ids": [1]
}
```

**レスポンス（成功）:**
- **ステータスコード:** 201
```json
{
  "success": true,
  "message": "アナウンスが作成されました",
  "data": {
    "id": 1,
    "title": "システムメンテナンスのお知らせ",
    "created_at": "2024-01-01T12:00:00.000Z"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 500: サーバーエラー

#### GET `/api/announcements/admin/:announcement_id`
管理者用：アナウンス詳細取得

**説明:** 指定されたIDのアナウンス詳細情報を取得します。

**認証:** 必須（JWTトークン、ロール4以上）

**パラメータ:**
- `announcement_id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "システムメンテナンスのお知らせ",
    "content": "2024年1月10日にメンテナンスを実施します",
    "target_users": [1, 2, 3],
    "target_instructors": [4, 5],
    "created_at": "2024-01-01T12:00:00.000Z"
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 404: アナウンスが見つからない
- 500: サーバーエラー

### 29. メッセージ管理 (`/api/messages`)

#### POST `/api/messages/send`
個人メッセージ送信

**説明:** 個人メッセージを送信します。メッセージはサニタイズ処理され、有効期限（日本時間の翌日24:30）が設定されます。プッシュ通知も送信されます。

**認証:** 必須（JWTトークン）

**バリデーション:**
- `receiver_id`: 必須、整数
- `message`: 必須、文字列（空文字列不可）

**リクエスト:**
```json
{
  "receiver_id": 1,
  "message": "こんにちは。学習の進捗はいかがですか？"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 201
```json
{
  "success": true,
  "message": "メッセージを送信しました",
  "data": {
    "id": 1,
    "sender": {
      "id": 4,
      "name": "指導員1",
      "role": 4
    },
    "receiver": {
      "id": 1,
      "name": "利用者1",
      "role": 1
    },
    "message": "こんにちは。学習の進捗はいかがですか？",
    "created_at": "2024-01-01T12:00:00.000Z"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（receiver_id/messageが未指定、またはmessageが空文字列）
- 404: 受信者が見つからない
- 500: サーバーエラー

**注意事項:**
- メッセージはXSS対策のためサニタイズ処理されます
- メッセージの有効期限は日本時間の翌日24:30（翌日の0:30）に設定されます
- プッシュ通知が設定されている場合は、受信者に通知が送信されます

#### GET `/api/messages/conversations`
個人メッセージ一覧取得（送信者・受信者別）

**説明:** 現在のユーザーとの会話相手一覧を取得します（期限切れのメッセージは除外）。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "other_user_id": 1,
      "other_user_name": "利用者1",
      "other_user_role": 1,
      "last_message_at": "2024-01-01T12:00:00.000Z",
      "unread_count": 2
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/messages/conversation/:other_user_id`
特定ユーザーとのメッセージ履歴取得

**説明:** 指定されたユーザーとのメッセージ履歴を取得します。取得時に未読メッセージが既読に更新されます。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `other_user_id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sender_id": 4,
      "receiver_id": 1,
      "message": "こんにちは。学習の進捗はいかがですか？",
      "is_read": true,
      "read_at": "2024-01-01T12:05:00.000Z",
      "created_at": "2024-01-01T12:00:00.000Z",
      "expires_at": "2024-01-02T00:30:00.000Z",
      "sender_name": "指導員1",
      "receiver_name": "利用者1"
    }
  ]
}
```

**エラーケース:**
- 400: 無効なユーザーID
- 401: 認証エラー
- 500: サーバーエラー

#### GET `/api/messages/unread-count`
未読メッセージ数取得

**説明:** 現在のユーザーの未読メッセージ数を取得します（ダッシュボードのバッジ表示用）。

**認証:** 必須（JWTトークン）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "unread_count": 5
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 500: サーバーエラー

#### PUT `/api/messages/read/:message_id`
メッセージ既読更新

**説明:** 指定されたメッセージを既読にマークします。

**認証:** 必須（JWTトークン）

**パラメータ:**
- `message_id`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "メッセージを既読にしました"
}
```

**レスポンス（失敗）:**
- **ステータスコード:** 404
```json
{
  "success": false,
  "message": "メッセージが見つからないか、権限がありません"
}
```

**エラーケース:**
- 400: 無効なメッセージID
- 401: 認証エラー
- 404: メッセージが見つからない、または権限がない
- 500: サーバーエラー

#### GET `/api/messages/students`
指導員が担当する利用者一覧取得（メッセージ送信用）

**説明:** 指導員が担当する利用者一覧を取得します（メッセージ送信用）。フィルタリング機能（担当指導員、名前、タグ、拠点）をサポートします。

**認証:** 必須（JWTトークン、ロール4以上）

**クエリパラメータ:**
- `instructor_filter`: オプション、文字列（'my', 'other', 'none', 'all', 'specific'、デフォルト: 'all'）
- `instructor_ids`: オプション、文字列（カンマ区切りの整数、instructor_filter='specific'の場合に使用）
- `name_filter`: オプション、文字列（名前の部分一致検索）
- `tag_filter`: オプション、文字列（タグの部分一致検索）
- `satellite_id`: オプション、整数（フロントエンドから送信される拠点ID）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "利用者1",
      "email": "user1@example.com",
      "login_code": "USER-0001-0001",
      "instructor_id": 4,
      "satellite_name": "渋谷拠点",
      "company_name": "株式会社サンプル",
      "instructor_name": "指導員1",
      "is_my_assigned": 1,
      "tags": "タグ1,タグ2",
      "progress": 65.5
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 500: サーバーエラー

#### GET `/api/messages/instructors`
利用者が所属拠点の指導員一覧取得（メッセージ送信用）

**説明:** 利用者が所属する拠点の指導員一覧を取得します（メッセージ送信用）。担当指導員を最上位に表示します。

**認証:** 必須（JWTトークン、ロール1-3）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "instructors": [
      {
        "id": 4,
        "name": "指導員1",
        "email": "instructor1@example.com",
        "role": 4,
        "is_assigned": 1,
        "satellite_name": "渋谷拠点",
        "company_name": "株式会社サンプル"
      }
    ],
    "assigned_instructor_id": 4
  }
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール1-3以外）
- 404: ユーザー情報が見つからない
- 500: サーバーエラー

#### GET `/api/messages/instructors-for-filter`
拠点の指導員一覧取得（フィルター用）

**説明:** 拠点の指導員一覧を取得します（フィルター用）。管理者・指導員（ロール4以上）が利用者（ロール1）を対象として取得します。

**認証:** 必須（JWTトークン、ロール4以上）

**クエリパラメータ:**
- `satellite_id`: オプション、整数（フロントエンドから送信される拠点ID）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "利用者1",
      "role": 1,
      "role_name": "利用者",
      "satellite_name": "渋谷拠点",
      "company_name": "株式会社サンプル"
    }
  ]
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 500: サーバーエラー

### 30. 利用者学習管理 (`/api/student`)

#### GET `/api/student/courses`
利用者のコース一覧取得（認証を柔軟に処理）

#### GET `/api/student/lessons`
利用者のレッスン一覧取得（認証を柔軟に処理）

#### GET `/api/student/lessons/:lessonId/progress`
利用者のレッスン進捗取得（認証を柔軟に処理）

#### PUT `/api/student/lessons/:lessonId/progress`
利用者のレッスン進捗更新（認証を柔軟に処理）

#### GET `/api/student/dashboard`
利用者のダッシュボード情報取得（認証を柔軟に処理）

### 31. 提出物管理 (`/api/submissions`)

#### GET `/api/submissions/instructor/pending-submissions/:satelliteId`
指導員用：拠点内の未承認提出物一覧取得

**説明:** 指定された拠点内の未承認提出物一覧を取得します。

**認証:** 必須（JWTトークン、ロール4以上）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "submission_id": 1,
      "user_id": 1,
      "lesson_id": 1,
      "file_url": "doc/COMP-0001-0001/SATE-0001-0001/USER-0001-0001/1/2024_0101_120000.zip",
      "file_name": "assignment.zip",
      "file_size": 1024000,
      "file_type": "other",
      "uploaded_at": "2024-01-01T12:00:00.000Z",
      "instructor_approved": false,
      "instructor_id": null,
      "student_name": "利用者1",
      "student_login_code": "USER-0001-0001",
      "lesson_name": "JavaScript基礎",
      "course_title": "基礎プログラミング",
      "satellite_name": "渋谷拠点"
    }
  ],
  "message": "未承認提出物一覧を取得しました"
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 500: サーバーエラー

#### GET `/api/submissions/instructor/student/:studentId/submissions`
指導員用：特定利用者の提出物一覧取得

**説明:** 指定された利用者の提出物一覧を取得します（承認済み・未承認を含む）。

**認証:** 必須（JWTトークン、ロール4以上）

**パラメータ:**
- `studentId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": [
    {
      "submission_id": 1,
      "user_id": 1,
      "lesson_id": 1,
      "file_url": "doc/COMP-0001-0001/SATE-0001-0001/USER-0001-0001/1/2024_0101_120000.zip",
      "file_name": "assignment.zip",
      "uploaded_at": "2024-01-01T12:00:00.000Z",
      "instructor_approved": true,
      "instructor_approved_at": "2024-01-02T10:00:00.000Z",
      "instructor_comment": "よくできています",
      "instructor_id": 4,
      "student_name": "利用者1",
      "lesson_name": "JavaScript基礎",
      "course_title": "基礎プログラミング",
      "approver_name": "指導員1"
    }
  ],
  "message": "利用者の提出物一覧を取得しました"
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 500: サーバーエラー

#### GET `/api/submissions/instructor/download/:submissionId`
指導員用：提出物ダウンロード

**説明:** 指定された提出物ファイルをダウンロードします。

**認証:** 必須（JWTトークン、ロール4以上）

**パラメータ:**
- `submissionId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
- **Content-Type:** `application/octet-stream`
- **Content-Disposition:** `attachment; filename*=UTF-8''<ファイル名>`
- **Body:** ファイルのバイナリデータ

**レスポンス（失敗）:**
- **ステータスコード:** 404
```json
{
  "success": false,
  "message": "提出物が見つかりません"
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 404: 提出物が見つからない
- 500: サーバーエラー（S3ダウンロード失敗など）

#### POST `/api/submissions/instructor/approve-submission`
指導員用：提出物承認

**説明:** 指定された提出物を承認します。承認後、テストも承認済みの場合はレッスンが完了状態になります。

**認証:** 必須（JWTトークン、ロール4以上）

**バリデーション:**
- `submissionId`: 必須、整数
- `studentId`: 必須、整数
- `lessonId`: 必須、整数
- `comment`: オプション、文字列

**リクエスト:**
```json
{
  "submissionId": 1,
  "studentId": 1,
  "lessonId": 1,
  "comment": "よくできています"
}
```

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "提出物の承認が完了しました",
  "completed": false,
  "data": {
    "submissionId": 1,
    "studentId": 1,
    "lessonId": 1,
    "approvedAt": "2024-01-02T10:00:00.000Z"
  }
}
```

**レスポンス（レッスン完了時）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "message": "レッスンが完了しました",
  "completed": true,
  "data": {
    "submissionId": 1,
    "studentId": 1,
    "lessonId": 1,
    "approvedAt": "2024-01-02T10:00:00.000Z"
  }
}
```

**エラーケース:**
- 400: バリデーションエラー（必須パラメータが未指定）
- 400: レッスンに提出物が設定されていない
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 500: サーバーエラー

#### GET `/api/submissions/instructor/pending-count/:satelliteId`
指導員用：拠点内の未承認提出物件数取得（アラート用）

**説明:** 指定された拠点内の未承認提出物件数を取得します（ダッシュボードのアラート表示用）。

**認証:** 必須（JWTトークン、ロール4以上）

**パラメータ:**
- `satelliteId`: 必須、整数（URLパラメータ）

**レスポンス（成功）:**
- **ステータスコード:** 200
```json
{
  "success": true,
  "data": {
    "count": 5
  },
  "message": "未承認提出物件数を取得しました"
}
```

**エラーケース:**
- 401: 認証エラー
- 403: 権限エラー（ロール4未満）
- 500: サーバーエラー

### 32. その他のエンドポイント

#### GET `/api/health`
ヘルスチェック

#### GET `/api/cors-test`
CORS設定確認

#### GET `/memory`
メモリ監視

#### GET `/memory/report`
メモリレポート

## データベーススキーマ

### 主要テーブル

#### user_accounts
ユーザー情報テーブル
```sql
CREATE TABLE `user_accounts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `role` TINYINT NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `login_code` CHAR(14) NOT NULL,
  `company_id` INT DEFAULT NULL,
  `satellite_ids` JSON DEFAULT NULL,
  `is_remote_user` BOOLEAN NOT NULL DEFAULT FALSE,
  `recipient_number` VARCHAR(30) DEFAULT NULL,
  `password_reset_required` TINYINT(1) NOT NULL DEFAULT 0,
  `instructor_id` INT DEFAULT NULL
);
```

#### companies
企業情報テーブル
```sql
CREATE TABLE `companies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `address` TEXT DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `token` VARCHAR(14) DEFAULT NULL,
  `token_issued_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### satellites
拠点テーブル
```sql
CREATE TABLE `satellites` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `address` TEXT DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `office_type_id` INT DEFAULT NULL,
  `token` VARCHAR(14) DEFAULT NULL,
  `contract_type` ENUM('30days', '90days', '1year') DEFAULT '30days',
  `max_users` INT NOT NULL DEFAULT 10,
  `status` TINYINT NOT NULL DEFAULT 1,
  `manager_ids` JSON DEFAULT NULL,
  `disabled_course_ids` JSON DEFAULT NULL,
  `token_issued_at` DATETIME NOT NULL,
  `token_expiry_at` DATETIME NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### courses
コース管理テーブル
```sql
CREATE TABLE `courses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(100) NOT NULL DEFAULT '選択科目',
  `status` ENUM('active', 'inactive', 'draft') DEFAULT 'active',
  `order_index` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### lessons
レッスン管理テーブル
```sql
CREATE TABLE `lessons` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `duration` VARCHAR(50),
  `order_index` INT NOT NULL DEFAULT 0,
  `has_assignment` BOOLEAN NOT NULL DEFAULT FALSE,
  `s3_key` VARCHAR(1024),
  `file_type` VARCHAR(50),
  `file_size` BIGINT,
  `status` ENUM('active', 'inactive', 'draft', 'deleted') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### user_lesson_progress
利用者レッスン進捗テーブル
```sql
CREATE TABLE `user_lesson_progress` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `lesson_id` INT NOT NULL,
  `status` ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'not_started',
  `completed_at` DATETIME DEFAULT NULL,
  `test_score` INT DEFAULT NULL,
  `assignment_submitted` BOOLEAN NOT NULL DEFAULT FALSE,
  `assignment_submitted_at` DATETIME DEFAULT NULL,
  `instructor_approved` BOOLEAN NOT NULL DEFAULT FALSE,
  `instructor_approved_at` DATETIME DEFAULT NULL,
  `instructor_id` INT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## エラーハンドリング

### 標準エラーレスポンス
```json
{
  "success": false,
  "message": "エラーメッセージ",
  "error": "エラー詳細",
  "code": "ERROR_CODE"
}
```

### HTTPステータスコード
- **200**: 成功
- **201**: 作成成功
- **400**: バリデーションエラー
- **401**: 認証エラー
- **403**: 権限エラー
- **404**: リソースが見つからない
- **500**: サーバーエラー

## セキュリティ

### CORS設定
- 開発環境: すべてのオリジンを許可
- 本番環境: 特定のオリジンのみ許可

### 認証
- JWT トークンベース認証
- リフレッシュトークンによる自動更新
- ロールベースアクセス制御

### バリデーション
- express-validatorによる入力値検証
- SQLインジェクション対策
- XSS対策

## ファイル管理

### S3統合
- AWS S3を使用したファイルストレージ
- 署名付きURLによる安全なファイルアクセス
- ファイルタイプ制限（PDF、ZIP等）

### サポートファイル形式
- **PDF**: レッスン資料、成果物
- **ZIP**: 成果物アップロード
- **画像**: プロフィール画像、成果物

## 監視・ログ

### ログレベル
- **INFO**: 一般的な情報
- **WARN**: 警告
- **ERROR**: エラー
- **DEBUG**: デバッグ情報

### 監視機能
- メモリ使用量監視
- データベース接続監視
- API レスポンス時間監視

## 開発・デプロイ

### 環境変数
```bash
NODE_ENV=development
PORT=5050
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=curriculum-portal
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=studysphere
OPENAI_API_KEY=your_openai_key
```

### 起動方法
```bash
# 開発環境
npm run dev

# 本番環境
npm start
```

### Docker対応
- Dockerfile.prod
- docker-compose.prod.yml
- 本番環境用の設定ファイル

## 時間管理システム

### 時間変換の仕組み
- **バックエンド**: データベースにはUTCで保存、APIレスポンスはUTCで返却
- **フロントエンド**: バックエンドから受信したUTC時間をJSTに変換して表示
- **フロントエンド→バックエンド**: JST時間を送信、バックエンドでUTC変換してDB保存

### 実装例
```javascript
// フロントエンド → バックエンド（JST送信）
const jstTime = "2024-01-01T15:30:00+09:00";

// バックエンドでUTC変換してDB保存
const utcTime = new Date(jstTime).toISOString(); // "2024-01-01T06:30:00.000Z"

// バックエンド → フロントエンド（UTC返却）
const utcResponse = "2024-01-01T06:30:00.000Z";

// フロントエンドでJST変換して表示
const jstTime = new Date(utcResponse).toLocaleString('ja-JP', {timeZone: 'Asia/Tokyo'});
```

### 時間管理ユーティリティ
- `getCurrentJapanTime()`: 現在の日本時間取得
- `convertUTCToJapanTime()`: UTC→JST変換
- `convertJapanTimeToUTC()`: JST→UTC変換
- `formatMySQLDateTime()`: MySQL DATETIME形式変換
- `isExpired()`: 有効期限チェック（日本時間基準）

## 注意事項

1. **時間管理**: バックエンドはUTC、フロントエンドはJSTで管理
2. **トークン形式**: 14文字のハイフン区切り形式（XXXX-XXXX-XXXX）
3. **ファイルサイズ制限**: アップロードファイルは10MB以下
4. **セッション管理**: JWT トークンの有効期限は24時間
5. **データベース**: 論理削除を基本とし、物理削除は管理者のみ

## API影響分析マトリクス

### 概要

このセクションでは、各APIエンドポイントがフロントエンドのどの画面・機能に影響するかを分析しています。
APIの変更・障害発生時の影響範囲を迅速に特定するための参考資料としてご活用ください。

### 活用シーン

1. **API変更時の影響調査**
   - バックエンドAPIのエンドポイント変更時、どのフロントエンドコンポーネントを修正すべきか特定
   - データ構造変更時の影響範囲の把握

2. **障害発生時の影響範囲特定**
   - 特定APIがダウンした場合、どの画面・機能が使用不可になるかを即座に判断
   - ユーザーへの影響度評価と優先度付け

3. **新機能開発時の参考資料**
   - 既存APIの使用状況を把握し、類似機能の実装時に参考にする
   - API設計時のベストプラクティス確認

4. **バグ修正時のトラブルシューティング**
   - 特定画面のバグ発生時、関連するAPIエンドポイントを迅速に特定
   - API呼び出しの流れを理解し、根本原因を追跡

5. **ローンチ前の最終チェック**
   - 影響度「高」のAPIが正常に動作しているか優先的に確認
   - 基幹機能のテストシナリオ作成時の参考資料

### 統計情報

- **総APIエンドポイント数**: 約200+
- **影響度「高」のAPI**: 約50エンドポイント
- **影響度「中」のAPI**: 約100エンドポイント
- **影響度「低」のAPI**: 約50エンドポイント

### API分類

APIは以下の32カテゴリに分類されています：

1. 認証関連（ログイン・ログアウト・トークン管理）
2. 企業管理（事業所の作成・編集・削除）
3. 拠点管理（拠点の作成・編集・統計情報）
4. ユーザー管理（利用者の作成・編集・削除）
5. 管理者管理（管理者アカウントの管理）
6. コース管理（コースの作成・編集・削除）
7. レッスン管理（レッスンの作成・編集・ファイル管理）
8. 学習管理（進捗追跡・課題提出・テスト結果）
9. AI機能（AIアシスタント・PDF解析）
10. ダッシュボード（統計情報・概要表示）
11. ログ管理（システムログの管理）
12. 操作ログ（監査ログの管理）
13. 現在受講中レッスン管理（学習進捗の追跡）
14. カリキュラムパス管理（学習パスの作成・割り当て）
15. 指導員専門分野管理（指導員の専門分野設定）
16. レッスンテキストファイル管理（複数テキストファイル管理）
17. レッスンテキスト・動画リンク管理（テキストと動画の紐づけ）
18. レッスン動画管理（動画コンテンツの管理）
19. 管理者拠点管理（管理者の拠点管理）
20. 事業所タイプ管理（事業所タイプの管理）
21. PDF処理管理（PDFファイルの処理・解析）
22. 個別支援計画管理（支援計画の作成・管理）
23. 一時パスワード管理（一時パスワードの発行・検証）
24. テスト・学習効果管理（テスト生成・採点・承認）
25. 利用者コース管理（コース割り当て・管理）
26. ユーザー名検証（username重複チェック）
27. 在宅支援管理（在宅利用者の日報・評価）
28. アナウンス管理（通知・アナウンス機能）
29. メッセージ管理（個人メッセージ機能）
30. 利用者学習管理（利用者向け学習機能）
31. 提出物管理（課題提出・承認管理）
32. その他（ヘルスチェック・監視）

### 1. 認証関連API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| POST `/api/login` | ログイン画面（管理者）、全画面の認証状態 | 高 | 管理者ログイン。認証が通らないとシステム全体が使用不可。アクセストークンとリフレッシュトークンの発行処理 |
| POST `/api/instructor-login` | ログイン画面（指導員）、企業・拠点選択ダイアログ | 高 | 指導員ログイン。企業と拠点を選択して認証。指導員がシステムにアクセスするための必須API |
| POST `/api/refresh` | 全画面（トークン自動更新） | 高 | トークンリフレッシュ処理。自動更新が失敗するとユーザーが強制ログアウトされる |
| POST `/api/logout` | ヘッダーのログアウトボタン | 中 | ログアウト処理。失敗してもクライアント側でトークン削除は可能 |
| GET `/api/user-info` | 全画面（ユーザー情報表示）、AuthContext | 高 | 現在ログイン中のユーザー情報取得。ユーザー名、ロール、権限判定に使用 |
| POST `/api/users/verify-temp-password` | 利用者ログイン画面（一時パスワード認証） | 高 | 利用者の一時パスワード検証。利用者がシステムにアクセスするための必須API |

### 2. 企業管理API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/companies` | 事業所管理画面、企業選択ドロップダウン | 高 | 企業一覧表示。指導員ログイン時の企業選択にも使用 |
| GET `/api/companies/:id` | 企業詳細モーダル、編集フォーム | 中 | 特定企業の詳細情報取得 |
| POST `/api/companies` | 企業作成フォーム | 中 | 新規企業登録処理 |
| PUT `/api/companies/:id` | 企業編集フォーム | 中 | 企業情報更新処理 |
| DELETE `/api/companies/:id` | 企業削除ボタン | 中 | 企業削除処理。関連データの整合性に注意 |
| POST `/api/companies/:id/regenerate-token` | 企業管理画面（トークン再生成ボタン） | 低 | 企業トークンの再生成。既存の利用者ログインには影響しない |

### 3. 拠点管理API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/satellites` | 事業所（拠点）管理画面、拠点選択ドロップダウン | 高 | 拠点一覧表示。指導員ログイン時の拠点選択にも使用 |
| GET `/api/satellites/:id` | 拠点詳細モーダル、編集フォーム | 中 | 特定拠点の詳細情報取得 |
| GET `/api/satellites/by-ids?ids=[1,2,3]` | 利用者管理画面（所属拠点表示）、指導員情報 | 高 | 複数拠点情報の一括取得。利用者・指導員の所属拠点名表示に使用 |
| POST `/api/satellites` | 拠点作成フォーム | 中 | 新規拠点登録処理。契約タイプ、最大利用者数などの設定 |
| PUT `/api/satellites/:id` | 拠点編集フォーム | 中 | 拠点情報更新処理 |
| DELETE `/api/satellites/:id` | 拠点削除ボタン | 中 | 拠点削除処理。所属ユーザーの処理に注意 |
| GET `/api/satellites/:id/users` | 拠点ダッシュボード（利用者一覧） | 高 | 拠点所属の利用者一覧表示 |
| GET `/api/satellites/:id/instructors` | 拠点管理画面（指導員一覧） | 中 | 拠点所属の指導員一覧表示 |
| GET `/api/satellites/:id/stats` | 拠点ダッシュボード（統計情報） | 中 | 拠点の統計情報（利用者数、進捗率など）表示 |
| GET `/api/satellites/:id/disabled-courses` | 拠点設定画面（無効化コース管理） | 低 | 拠点で無効化されているコース一覧 |
| PUT `/api/satellites/:id/disabled-courses` | 拠点設定画面（無効化コース更新） | 低 | 拠点の無効化コース設定更新 |

### 4. ユーザー管理API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/users` | 利用者管理画面、利用者一覧テーブル | 高 | 利用者一覧取得。フィルタリング、検索機能の基盤 |
| POST `/api/users/create` | 利用者作成フォーム、利用者追加モーダル | 高 | 新規利用者登録。在宅利用者フラグ、受給者番号などの設定 |
| POST `/api/users/bulk-create` | 一括利用者追加機能 | 中 | 複数利用者の一括登録。CSV/Excel読み込み機能と連携 |
| PUT `/api/users/:userId` | 利用者編集フォーム、プロフィール編集 | 高 | 利用者情報更新。所属拠点、担当指導員の変更も含む |
| DELETE `/api/users/:userId` | 利用者削除ボタン | 中 | 利用者削除（論理削除）。学習履歴との整合性に注意 |
| POST `/api/users/:userId/reset-password` | パスワードリセットボタン | 中 | パスワードリセット機能 |
| POST `/api/users/:userId/change-password` | パスワード変更フォーム | 中 | ユーザー自身によるパスワード変更 |
| POST `/api/users/:userId/issue-temp-password` | 一時パスワード発行ボタン、一時パスワード管理画面 | 高 | 利用者向け一時パスワード発行。有効期限管理が重要 |
| GET `/api/users/:userId/satellites` | 利用者詳細画面（所属拠点一覧） | 中 | 利用者が所属する拠点の一覧表示 |
| POST `/api/users/:userId/satellites` | 利用者編集フォーム（拠点追加） | 中 | 利用者への拠点追加処理 |
| DELETE `/api/users/:userId/satellites/:satelliteId` | 利用者編集フォーム（拠点削除） | 中 | 利用者からの拠点削除処理 |
| GET `/api/users/:userId/specializations` | 指導員管理画面（専門分野一覧） | 低 | 指導員の専門分野表示 |
| POST `/api/users/:userId/specializations` | 指導員編集フォーム（専門分野追加） | 低 | 指導員の専門分野追加 |
| PUT `/api/users/:userId/specializations/:specializationId` | 指導員編集フォーム（専門分野編集） | 低 | 指導員の専門分野更新 |
| DELETE `/api/users/:userId/specializations/:specializationId` | 指導員編集フォーム（専門分野削除） | 低 | 指導員の専門分野削除 |

### 5. 管理者管理API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/admins` | 管理者管理画面、管理者一覧テーブル | 中 | 管理者アカウント一覧表示 |
| POST `/api/admins` | 管理者作成フォーム | 中 | 新規管理者アカウント作成 |
| PUT `/api/admins/:adminId` | 管理者編集フォーム | 中 | 管理者情報更新 |
| DELETE `/api/admins/:adminId` | 管理者削除ボタン（論理削除） | 中 | 管理者の論理削除処理 |
| POST `/api/admins/:adminId/restore` | 管理者復元ボタン | 低 | 削除された管理者の復元 |
| DELETE `/api/admins/:adminId/permanent` | 管理者完全削除ボタン | 低 | 管理者の物理削除。復元不可 |

### 6. コース管理API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/courses` | コース管理画面、コース一覧、利用者学習画面 | 高 | コース一覧取得。利用者・指導員・管理者すべての画面で使用 |
| GET `/api/courses/:id` | コース詳細モーダル、コース編集フォーム | 中 | 特定コースの詳細情報取得 |
| POST `/api/courses` | コース作成フォーム | 中 | 新規コース作成 |
| PUT `/api/courses/:id` | コース編集フォーム | 中 | コース情報更新（タイトル、説明、カテゴリ、ステータスなど） |
| DELETE `/api/courses/:id` | コース削除ボタン | 中 | コース削除。関連レッスン、進捗データとの整合性に注意 |
| PUT `/api/courses/order` | コース管理画面（ドラッグ&ドロップ並び替え） | 低 | コースの表示順序変更 |

### 7. レッスン管理API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/lessons` | レッスン管理画面、レッスン一覧テーブル | 高 | レッスン一覧取得。コース別フィルタリング機能を含む |
| GET `/api/lessons/:id` | レッスン詳細モーダル、レッスン編集フォーム | 中 | 特定レッスンの詳細情報取得 |
| POST `/api/lessons` | レッスン作成フォーム（ファイルアップロード対応） | 高 | 新規レッスン作成。PDF/動画ファイルのアップロード処理。multipart/form-data形式 |
| PUT `/api/lessons/:id` | レッスン編集フォーム | 中 | レッスン情報更新 |
| DELETE `/api/lessons/:id` | レッスン削除ボタン | 中 | レッスン削除。S3ファイルとの同期に注意 |
| GET `/api/lessons/:id/download` | レッスン受講画面（ファイルダウンロードボタン） | 中 | レッスンファイルのダウンロード。署名付きURL生成 |
| GET `/api/lessons/:id/files` | レッスン管理画面（ファイル一覧） | 低 | レッスンに関連するファイル一覧取得 |

### 8. 学習管理API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/learning/progress/:userId` | 利用者ダッシュボード、学習進捗画面 | 高 | 利用者の全体的な学習進捗取得 |
| GET `/api/learning/progress/:userId/course/:courseId` | コース別進捗詳細画面 | 高 | 特定コースの詳細進捗情報取得 |
| PUT `/api/learning/progress/lesson` | レッスン受講画面（レッスン完了時） | 高 | レッスン進捗の更新・保存。**時間データの扱いに注意（UTC/JST変換）** |
| GET `/api/learning/current-lesson` | 利用者ダッシュボード（学習再開ボタン） | 中 | 現在受講中のレッスン取得 |
| POST `/api/learning/upload-assignment` | レッスン受講画面（成果物アップロード） | 高 | 成果物（ZIPファイル）のアップロード。ファイルサイズ制限に注意 |
| GET `/api/learning/lesson/:lessonId/uploaded-files` | レッスン受講画面（アップロード済みファイル一覧） | 中 | 既にアップロードされた成果物の一覧表示 |
| DELETE `/api/learning/lesson/:lessonId/uploaded-files/:fileId` | レッスン受講画面（ファイル削除ボタン） | 低 | アップロード済みファイルの削除 |
| GET `/api/learning/lesson/:lessonId/assignment-status` | レッスン受講画面（課題提出状況表示） | 中 | 課題の提出状況確認 |
| POST `/api/learning/test/submit` | テスト受験画面（テスト結果送信） | 高 | テスト結果の送信・保存。スコア計算に影響 |
| GET `/api/learning/test/results/:userId` | テスト結果一覧画面、成績画面 | 中 | 利用者のテスト結果履歴取得 |
| POST `/api/learning/approve-completion` | 指導員画面（レッスン承認ボタン） | 高 | 指導員による課題承認処理。修了判定に影響 |
| GET `/api/learning/lesson/:lessonId/content` | レッスン受講画面（コンテンツ表示） | 高 | レッスンのPDF/テキストコンテンツ取得。AI機能のコンテキストにも使用 |
| POST `/api/learning/assign-course` | 利用者管理画面（コース割り当てボタン） | 高 | 利用者へのコース割り当て処理 |
| GET `/api/learning/certificate/:userId/:lessonId` | 合格証明書表示画面 | 中 | 特定レッスンの合格証明書取得・表示 |
| GET `/api/learning/certificates/:userId` | 利用者ダッシュボード（証明書一覧） | 中 | 利用者が取得した証明書の一覧表示 |

### 9. AI機能API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| POST `/api/ai/assist` | レッスン受講画面（AIアシスタントチャット） | 中 | AIによる質問応答機能。OpenAI APIを使用。トークン消費量に注意 |
| GET `/api/ai/status` | レッスン受講画面（AI機能有効化状態確認） | 低 | AI機能の利用可能状態確認 |
| GET `/api/ai/section-text/:lessonId` | AI機能（セクションテキスト取得） | 低 | レッスンのセクションテキスト抽出 |
| GET `/api/ai/pdf-status/:userId` | レッスン受講画面（PDF処理状態表示） | 低 | PDFの解析・処理状態確認 |

### 10. ダッシュボードAPI

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/dashboard` | 各種ダッシュボード画面 | 中 | ダッシュボード概要情報取得 |
| GET `/api/dashboard/overview` | システム概要画面（管理者） | 中 | システム全体の統計情報（総利用者数、進捗率など） |
| GET `/api/dashboard/company/:id` | 企業別ダッシュボード | 中 | 企業別の統計情報表示 |
| GET `/api/dashboard/alerts` | ダッシュボード（アラート通知エリア） | 低 | システムアラート・通知の一覧表示 |

### 11. ログ管理API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/logs` | ログ管理画面（ログファイル一覧） | 低 | システムログファイルの一覧表示。管理者のみアクセス可能 |
| GET `/api/logs/:filename` | ログ管理画面（ログ内容表示） | 低 | 特定ログファイルの内容表示 |
| GET `/api/logs/:filename/download` | ログ管理画面（ログダウンロードボタン） | 低 | ログファイルのダウンロード |
| DELETE `/api/logs/:filename` | ログ管理画面（ログ削除ボタン） | 低 | ログファイルの削除 |
| POST `/api/logs/cleanup` | ログ管理画面（古いログクリーンアップボタン） | 低 | 古いログの一括削除 |
| GET `/api/logs/stats` | ログ管理画面（ログ統計情報） | 低 | ログの統計情報表示 |

### 12. 操作ログAPI

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/operation-logs` | 管理者管理画面（操作ログ一覧タブ） | 中 | 管理者の操作ログ一覧表示。監査目的 |
| GET `/api/operation-logs/stats` | 管理者管理画面（操作ログ統計） | 低 | 操作ログの統計情報 |
| GET `/api/operation-logs/export` | 管理者管理画面（ログエクスポートボタン） | 低 | 操作ログのCSV/JSONエクスポート |
| DELETE `/api/operation-logs` | 管理者管理画面（ログクリアボタン） | 低 | 操作ログの削除 |

### 13. カリキュラムパス管理API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/curriculum-paths` | カリキュラムパス管理画面、パス一覧 | 高 | カリキュラムパス一覧取得。コース割り当て機能の基盤 |
| GET `/api/curriculum-paths/:id` | カリキュラムパス詳細モーダル | 中 | 特定パスの詳細情報取得 |
| GET `/api/curriculum-paths/available-courses` | カリキュラムパス作成/編集フォーム | 中 | パスに追加可能なコース一覧取得 |
| POST `/api/curriculum-paths` | カリキュラムパス作成フォーム | 中 | 新規カリキュラムパス作成 |
| PUT `/api/curriculum-paths/:id` | カリキュラムパス編集フォーム | 中 | カリキュラムパス情報更新 |
| DELETE `/api/curriculum-paths/:id` | カリキュラムパス削除ボタン | 中 | カリキュラムパス削除 |
| GET `/api/satellites/:satelliteId/user-courses` | 利用者管理画面（コース割り当て状況） | 高 | 拠点内利用者のコース割り当て状況取得 |
| GET `/api/satellites/:satelliteId/available-courses` | 利用者管理画面（コース割り当てモーダル） | 高 | 拠点で利用可能なコース一覧取得。無効化コース除外 |
| GET `/api/satellites/:satelliteId/available-curriculum-paths` | 利用者管理画面（カリキュラムパス割り当て） | 高 | 拠点で利用可能なカリキュラムパス一覧取得 |
| POST `/api/satellites/:satelliteId/bulk-assign-courses` | 利用者管理画面（コース一括割り当て） | 高 | 複数利用者へのコース一括割り当て |
| POST `/api/satellites/:satelliteId/bulk-remove-courses` | 利用者管理画面（コース一括削除） | 中 | 複数利用者からのコース一括削除 |
| POST `/api/satellites/:satelliteId/bulk-assign-curriculum-paths` | 利用者管理画面（カリキュラムパス一括割り当て） | 高 | 複数利用者へのカリキュラムパス一括割り当て |

### 14. メッセージ・アナウンスAPI

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/announcements/admin` | アナウンス管理画面（管理者・指導員） | 中 | 送信済みアナウンス一覧取得。拠点フィルタリング可能 |
| POST `/api/announcements/admin/create` | アナウンス作成フォーム | 中 | 新規アナウンス作成・送信 |
| GET `/api/announcements/user` | 利用者ダッシュボード（アナウンス一覧） | 中 | 利用者向けアナウンス取得 |
| POST `/api/messages/send` | メッセージ送信フォーム | 中 | 1対1メッセージ送信 |
| GET `/api/messages/conversations` | メッセージ画面（会話一覧） | 中 | ユーザーの会話一覧取得 |
| GET `/api/messages/conversation/:userId` | メッセージ画面（会話詳細） | 中 | 特定ユーザーとの会話履歴取得 |
| GET `/api/messages/unread-count` | ヘッダー（未読メッセージバッジ） | 中 | 未読メッセージ数取得。ポーリング処理で定期取得 |
| PUT `/api/messages/:messageId/read` | メッセージ詳細画面（既読処理） | 低 | メッセージを既読にマーク |

### 15. 在宅支援管理API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/users/satellite/:satelliteId/home-support-users` | 在宅支援利用者追加モーダル | 中 | 在宅支援に追加可能な通所利用者一覧 |
| GET `/api/users/satellite/:satelliteId/home-support-users-list` | 在宅支援管理画面（在宅利用者一覧） | 高 | 拠点の在宅支援対象利用者一覧取得 |
| GET `/api/users/satellite/:satelliteId/home-support-instructors` | 在宅支援利用者追加モーダル | 中 | 在宅支援担当指導員一覧 |
| POST `/api/users/bulk-update-home-support` | 在宅支援利用者追加フォーム | 高 | 在宅支援フラグの一括更新 |
| PUT `/api/users/:userId/remove-home-support` | 在宅支援利用者削除ボタン | 中 | 在宅支援フラグの削除 |
| GET `/api/remote-support/daily-reports` | 在宅支援日報管理画面 | 高 | 利用者の日報一覧取得。日付フィルタリング可能 |
| GET `/api/remote-support/daily-reports/:reportId` | 日報詳細モーダル | 中 | 特定日報の詳細情報取得 |
| PUT `/api/remote-support/daily-reports/:reportId` | 日報編集フォーム | 中 | 日報内容の更新 |
| POST `/api/remote-support/daily-reports/:reportId/comments` | 日報コメント追加フォーム | 中 | 日報へのコメント追加（指導員フィードバック） |
| GET `/api/remote-support/evaluations/weekly` | 週次評価一覧画面 | 中 | 週次評価データ取得 |
| POST `/api/remote-support/evaluations/weekly` | 週次評価入力フォーム | 中 | 週次評価データの作成・保存 |
| GET `/api/remote-support/evaluations/monthly` | 月次評価一覧画面 | 中 | 月次評価データ取得 |
| POST `/api/remote-support/evaluations/monthly` | 月次評価入力フォーム | 中 | 月次評価データの作成・保存 |

### 16. 個別支援計画API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/support-plans` | 個別支援計画一覧画面 | 中 | 全支援計画の一覧取得 |
| GET `/api/support-plans/user/:userId` | 利用者詳細画面（支援計画タブ） | 中 | 特定利用者の支援計画取得 |
| POST `/api/support-plans` | 支援計画作成フォーム | 中 | 新規支援計画作成 |
| PUT `/api/support-plans/:id` | 支援計画編集フォーム | 中 | 支援計画更新 |
| DELETE `/api/support-plans/:id` | 支援計画削除ボタン | 低 | 支援計画削除 |
| POST `/api/support-plans/upsert` | 支援計画作成/更新フォーム | 中 | 支援計画の作成または更新（upsert処理） |

### 17. 利用者・指導員割り当てAPI

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/users/satellite/:satelliteId/instructor-relations` | 利用者管理画面（指導員割り当てビュー） | 高 | 拠点内の利用者と担当指導員の関係一覧取得 |
| GET `/api/users/satellite/:satelliteId/available-instructors` | 利用者編集フォーム（指導員選択ドロップダウン） | 高 | 拠点内の利用可能な指導員一覧取得 |
| PUT `/api/users/:userId/instructor` | 利用者編集フォーム（指導員変更） | 高 | 個別利用者の担当指導員変更 |
| PUT `/api/users/satellite/:satelliteId/bulk-instructor-assignment` | 利用者管理画面（指導員一括割り当て） | 高 | 複数利用者の担当指導員を一括変更 |
| DELETE `/api/users/satellite/:satelliteId/instructors` | 利用者管理画面（指導員一括解除ボタン） | 中 | 拠点内全利用者の担当指導員を一括削除 |

### 18. 一時パスワード管理API（追加）

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/temp-passwords/status/:loginCode` | 利用者ログイン画面（パスワード状態確認） | 中 | 一時パスワードの有効性確認 |
| POST `/api/users/:userId/mark-temp-password-used` | ログアウト処理 | 低 | ログアウト時に一時パスワードを使用済みにマーク |

### 19. テスト・合格承認API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/test/instructor/pending-approvals` | 指導員ダッシュボード（承認待ちリスト） | 中 | 拠点内の承認待ちテスト結果一覧取得 |
| POST `/api/test/instructor/approve` | 指導員画面（テスト承認ボタン） | 高 | テスト結果の承認処理 |
| POST `/api/test/instructor/reject` | 指導員画面（テスト却下ボタン） | 中 | テスト結果の却下処理 |

### 20. コース割り当て管理API（追加）

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/user-courses/satellite/:satelliteId/user-courses` | 利用者管理画面（コース割り当て状況） | 高 | 拠点内全利用者のコース割り当て状況取得 |
| GET `/api/user-courses/satellite/:satelliteId/available-courses` | コース割り当てモーダル | 高 | 拠点で利用可能なコース一覧（無効化コース除外） |
| GET `/api/user-courses/satellite/:satelliteId/available-curriculum-paths` | カリキュラムパス割り当てモーダル | 高 | 拠点で利用可能なカリキュラムパス一覧 |
| POST `/api/user-courses/satellite/:satelliteId/bulk-assign-courses` | コース一括割り当てフォーム | 高 | 複数利用者へのコース一括割り当て |
| POST `/api/user-courses/satellite/:satelliteId/bulk-remove-courses` | コース一括削除フォーム | 中 | 複数利用者からのコース一括削除 |
| POST `/api/user-courses/satellite/:satelliteId/bulk-assign-curriculum-paths` | カリキュラムパス一括割り当てフォーム | 高 | 複数利用者へのカリキュラムパス一括割り当て |

### 21. 拠点切り替え・再認証API

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| POST `/api/reauthenticate-satellite` | ヘッダーの拠点切り替えモーダル | 高 | 拠点変更時の再認証処理。セッションの拠点情報を更新 |

### 22. その他のAPI

| API エンドポイント | フロントエンドの画面/機能/コンポーネント | 影響度 | 備考 |
|-------------------|------------------------------------------|--------|------|
| GET `/api/health` | システム監視、ヘルスチェック処理 | 低 | APIサーバーの稼働状態確認 |
| GET `/api/cors-test` | 開発環境でのCORS設定確認 | 低 | CORS設定の動作確認用エンドポイント |
| GET `/memory` | システム監視画面（メモリ使用状況） | 低 | サーバーメモリ使用量の監視 |
| GET `/memory/report` | システム監視画面（メモリレポート） | 低 | 詳細なメモリレポート取得 |

### 影響度評価の基準

**高（High）**
- システムの基幹機能に直結するAPI
- 認証・ログイン処理
- データの保存・更新処理
- 複数画面で共通利用されるAPI
- 障害発生時にシステム全体またはメイン機能が使用不可になる

**中（Medium）**
- 特定画面の主要機能に使用されるAPI
- データの表示・取得処理
- 障害発生時に特定の画面・機能が使用不可になる
- ユーザー体験に影響を与えるが、システム全体は稼働可能

**低（Low）**
- 補助的な機能に使用されるAPI
- 管理者のみが使用する機能
- 統計情報や監視機能
- 障害発生時の影響が限定的

### 特に注意が必要な箇所

1. **時間データの扱い（UTC/JST変換）**
   - `/api/learning/progress/lesson` - レッスン完了時刻
   - `/api/users/:userId/issue-temp-password` - 一時パスワード有効期限
   - すべての `created_at`, `updated_at`, `completed_at` フィールド

2. **ファイルアップロード処理**
   - `/api/lessons` - レッスンファイル（PDF/動画）のアップロード
   - `/api/learning/upload-assignment` - 成果物のアップロード
   - multipart/form-data形式、ファイルサイズ制限（10MB）

3. **トークン管理**
   - `/api/refresh` - トークンリフレッシュの自動処理
   - `/api/login`, `/api/instructor-login` - トークン発行
   - JWT有効期限（24時間）

4. **データ整合性**
   - 企業・拠点・ユーザーの削除処理
   - コース・レッスンの削除と進捗データの整合性
   - 論理削除と物理削除の使い分け

5. **権限チェック**
   - ロールベースアクセス制御（ロール1: 利用者、ロール4: 指導員、ロール5-9: 管理者）
   - 拠点間のデータ分離
   - 指導員は同一拠点内の利用者のみ管理可能

## 更新履歴

- **v1.0.0**: 初回リリース
- 認証システム実装
- 基本CRUD操作実装
- ファイルアップロード機能実装
- AI機能統合
- 学習進捗管理機能実装
- **v1.1.0**: API影響分析マトリクスを追加
- **v1.2.0**: 不足していたAPIエンドポイントを追加
