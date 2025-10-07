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

**リクエスト:**
```json
{
  "username": "admin001",
  "password": "admin123"
}
```

**レスポンス:**
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

#### POST `/api/instructor-login`
指導員ログイン（企業・拠点選択）

**リクエスト:**
```json
{
  "username": "instructor001",
  "password": "password123",
  "companyId": 1,
  "satelliteId": 1
}
```

#### POST `/api/refresh`
トークンリフレッシュ

**リクエスト:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST `/api/logout`
ログアウト

**リクエスト:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### GET `/api/user-info`
現在のユーザー情報取得

**ヘッダー:**
```
Authorization: Bearer <access_token>
```

### 2. 企業管理 (`/api/companies`)

#### GET `/api/companies`
企業一覧取得

**レスポンス:**
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

#### GET `/api/companies/:id`
企業詳細取得

#### POST `/api/companies`
企業作成

**リクエスト:**
```json
{
  "name": "株式会社新規企業",
  "address": "東京都新宿区...",
  "phone": "03-9876-5432"
}
```

#### PUT `/api/companies/:id`
企業更新

#### DELETE `/api/companies/:id`
企業削除

#### POST `/api/companies/:id/regenerate-token`
企業トークン再生成

### 3. 拠点管理 (`/api/satellites`)

#### GET `/api/satellites`
拠点一覧取得

#### GET `/api/satellites/:id`
拠点詳細取得

#### GET `/api/satellites/by-ids?ids=[1,2,3]`
複数拠点取得

#### POST `/api/satellites`
拠点作成

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

#### PUT `/api/satellites/:id`
拠点更新

#### DELETE `/api/satellites/:id`
拠点削除

#### GET `/api/satellites/:id/users`
拠点所属ユーザー一覧取得

#### GET `/api/satellites/:id/instructors`
拠点指導員一覧取得

#### GET `/api/satellites/:id/stats`
拠点統計情報取得

#### GET `/api/satellites/:id/disabled-courses`
無効化コース一覧取得

#### PUT `/api/satellites/:id/disabled-courses`
無効化コース一覧更新

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

**リクエスト:**
```json
{
  "loginCode": "USER-0001-0001",
  "tempPassword": "1234-5678"
}
```

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

**リクエスト:**
```
Content-Type: multipart/form-data

{
  "lessonId": 1,
  "file": <ZIPファイル>
}
```

#### GET `/api/learning/lesson/:lessonId/uploaded-files`
アップロード済みファイル取得

#### DELETE `/api/learning/lesson/:lessonId/uploaded-files/:fileId`
アップロード済みファイル削除

#### GET `/api/learning/lesson/:lessonId/assignment-status`
課題提出状況確認

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

#### POST `/api/ai/assist`
AIアシスタント

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

**レスポンス:**
```json
{
  "success": true,
  "answer": "JavaScriptの変数宣言には...",
  "usage": {
    "promptTokens": 500,
    "completionTokens": 200,
    "totalTokens": 700
  }
}
```

#### GET `/api/ai/status`
AI機能状態確認

#### GET `/api/ai/section-text/:lessonId`
セクションテキスト取得

#### GET `/api/ai/pdf-status/:userId`
PDF処理状態確認

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

### 13. その他のエンドポイント

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

## 更新履歴

- **v1.0.0**: 初回リリース
- 認証システム実装
- 基本CRUD操作実装
- ファイルアップロード機能実装
- AI機能統合
- 学習進捗管理機能実装
