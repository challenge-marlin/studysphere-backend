# ログシステム ドキュメント

## 概要

このバックエンドシステムには包括的なログ機能が実装されており、以下の機能を提供します：

- 構造化されたログ出力
- 複数のログレベル（error, warn, info, debug）
- ファイル出力とコンソール出力
- リクエスト/レスポンスログ
- データベース操作ログ
- 認証ログ
- パフォーマンス監視
- メモリ使用量監視
- ログファイル管理

## ログレベル

| レベル | 説明 | 用途 |
|--------|------|------|
| error | エラー | アプリケーションエラー、システムエラー |
| warn | 警告 | 潜在的な問題、非推奨機能の使用 |
| info | 情報 | 一般的な情報、重要なイベント |
| debug | デバッグ | 詳細なデバッグ情報 |

## ログファイル

### 生成されるログファイル

- `logs/error.log` - エラーログのみ
- `logs/combined.log` - 全ログ（infoレベル以上）
- `logs/debug.log` - デバッグログ（開発環境のみ）
- `logs/access.log` - アクセスログ

### ログローテーション

- ファイルサイズ制限: 5MB
- 保持ファイル数: 5個
- 古いログファイルの自動削除: 30日

## 環境変数設定

```bash
# ログレベル設定
LOG_LEVEL=info

# ログファイル設定
LOG_FILE_MAX_SIZE=5242880
LOG_FILE_MAX_FILES=5
LOG_CLEANUP_DAYS=30
```

## 使用方法

### 基本的なログ出力

```javascript
const { customLogger } = require('./utils/logger');

// エラーログ
customLogger.error('エラーが発生しました', { 
  userId: 123, 
  operation: 'login' 
});

// 警告ログ
customLogger.warn('パフォーマンスが低下しています', { 
  responseTime: 1500 
});

// 情報ログ
customLogger.info('ユーザーがログインしました', { 
  userId: 123, 
  ip: '192.168.1.1' 
});

// デバッグログ
customLogger.debug('データベースクエリ実行', { 
  query: 'SELECT * FROM users', 
  params: [123] 
});
```

### リクエスト/レスポンスログ

```javascript
// リクエストログ
customLogger.request(req, {
  requestId: 'req_1234567890_abc123'
});

// レスポンスログ
customLogger.response(req, res, responseTime, {
  requestId: 'req_1234567890_abc123'
});
```

### データベースログ

```javascript
// データベース操作ログ
customLogger.database('SELECT', 'SELECT * FROM users WHERE id = ?', [123], 45, {
  rowCount: 1
});
```

### 認証ログ

```javascript
// 認証イベントログ
customLogger.auth('login', 'user123', true, {
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});
```

### パフォーマンスログ

```javascript
// パフォーマンスイベントログ
customLogger.performance('API Request', 1200, {
  endpoint: '/api/users',
  method: 'GET'
});
```

### メモリ使用量ログ

```javascript
// メモリ使用量ログ
customLogger.memory(memoryStats, {
  context: 'after database operation'
});
```

## API エンドポイント

### ログファイル管理

#### ログファイル一覧取得
```
GET /api/logs
```

#### ログファイル内容取得
```
GET /api/logs/:filename?lines=100&level=error&search=error
```

パラメータ:
- `lines`: 取得する行数（デフォルト: 100）
- `level`: ログレベルフィルター
- `search`: 検索キーワード

#### ログファイルダウンロード
```
GET /api/logs/:filename/download
```

#### ログファイル削除
```
DELETE /api/logs/:filename
```

#### 古いログファイルクリーンアップ
```
POST /api/logs/cleanup?days=30
```

#### ログ統計情報取得
```
GET /api/logs/stats
```

## ログフォーマット

### ファイルログフォーマット
```
2024-01-15 10:30:45 [INFO]: ユーザーがログインしました {"userId":123,"ip":"192.168.1.1","service":"curriculum-portal-backend"}
```

### コンソールログフォーマット（開発環境）
```
10:30:45 [info]: ユーザーがログインしました {"userId":123,"ip":"192.168.1.1"}
```

## パフォーマンス監視

### 遅いリクエストの検出
- 1秒以上のリクエストは自動的に警告ログに記録されます

### メモリ使用量監視
- 500MB以上のメモリ使用量は警告ログに記録されます
- メモリリークの検出（50MB以上の増加）

### データベース監視
- 100ms以上のクエリはデバッグログに記録されます

## セキュリティ

### 機密情報のフィルタリング
以下の情報は自動的にログから除外されます：
- Authorization ヘッダー
- Cookie ヘッダー
- パスワードフィールド
- トークンフィールド

### アクセス制御
- ログファイルへのアクセスは管理者権限が必要です
- ディレクトリトラバーサル攻撃を防ぐセキュリティチェックが実装されています

## トラブルシューティング

### ログファイルが見つからない
1. `logs` ディレクトリが存在することを確認
2. アプリケーションの権限を確認
3. ディスク容量を確認

### ログが出力されない
1. `LOG_LEVEL` 環境変数を確認
2. ログディレクトリの書き込み権限を確認
3. アプリケーションの起動ログを確認

### ログファイルが大きすぎる
1. `LOG_FILE_MAX_SIZE` を調整
2. `LOG_FILE_MAX_FILES` を調整
3. 定期的なクリーンアップを実行

## ベストプラクティス

1. **適切なログレベルを使用**
   - エラーは `error` レベル
   - 警告は `warn` レベル
   - 一般的な情報は `info` レベル
   - デバッグ情報は `debug` レベル

2. **構造化されたログを記録**
   - メタデータを含める
   - 一貫したフォーマットを使用

3. **機密情報を除外**
   - パスワードやトークンを含めない
   - 個人情報を適切にマスク

4. **定期的なメンテナンス**
   - 古いログファイルを削除
   - ログファイルサイズを監視
   - ログ統計を確認

## 設定例

### 開発環境
```bash
NODE_ENV=development
LOG_LEVEL=debug
```

### 本番環境
```bash
NODE_ENV=production
LOG_LEVEL=warn
LOG_FILE_MAX_SIZE=10485760
LOG_FILE_MAX_FILES=10
``` 