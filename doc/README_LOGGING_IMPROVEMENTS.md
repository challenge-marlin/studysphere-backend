# ログ機能の改善 - 確実なログ記録の実装

## 概要
ログの記録が正しく動作していない問題を解決するため、包括的なログ改善を実装しました。

## 実装した改善点

### 1. ロガーの基本機能強化

#### ログの即座フラッシュ機能
- エラーログの即座フラッシュ
- プロセス終了時のログフラッシュ
- タイムアウト処理の改善

#### ログレベルの強制設定
- 有効なログレベルの強制確認
- デフォルトレベルの適切な設定
- ログレベルの動的確認機能

#### ログディレクトリの権限管理
- ディレクトリ権限の自動確認・修正
- 適切な権限（755）の設定
- 書き込み権限の確保

### 2. 例外処理とエラーハンドリング

#### 例外ハンドラーの追加
- 未処理例外の自動キャッチ
- Promise拒否の自動キャッチ
- 例外・拒否専用ログファイル

#### エラーログの詳細化
- スタックトレースの完全記録
- エラーコードの記録
- コンテキスト情報の追加

### 3. PDF処理のログ強化

#### リクエスト追跡
- ユニークなリクエストIDの生成
- 処理開始から完了までの完全追跡
- 各段階での詳細ログ記録

#### パフォーマンス監視
- 処理時間の詳細記録
- ファイルサイズの記録
- メモリ使用量の監視

#### エラー状況の詳細記録
- タイムアウトの詳細情報
- ファイルサイズ制限の詳細
- S3関連エラーの詳細

### 4. ログ管理ツール

#### ログテストスクリプト（test-logging.js）
- 各ログレベルの動作確認
- 特殊ログメソッドのテスト
- ログファイルの内容確認
- 権限と書き込みの確認

#### ログ管理ツール（log-manager.js）
- ログファイル一覧表示
- ログファイル内容表示
- ログファイル検索
- ログファイルクリーンアップ
- ログ統計情報表示
- リアルタイム監視

## 使用方法

### 基本的なログ記録

```javascript
const { customLogger } = require('./utils/logger');

// 基本ログ
customLogger.info('情報メッセージ', { context: 'example' });
customLogger.warn('警告メッセージ', { context: 'example' });
customLogger.error('エラーメッセージ', { context: 'example' });
customLogger.debug('デバッグメッセージ', { context: 'example' });

// 特殊ログ
customLogger.request(req, { context: 'api' });
customLogger.response(req, res, responseTime, { context: 'api' });
customLogger.database('SELECT', query, params, duration, { context: 'db' });
customLogger.auth('login', userId, success, { ip, userAgent });
customLogger.performance('operation', duration, { context: 'perf' });
customLogger.system('event', { context: 'system' });
customLogger.memory(process.memoryUsage(), { context: 'monitoring' });

// エラーログ（詳細）
customLogger.errorWithStack(error, { context: 'error_handling' });
```

### ログの即座フラッシュ

```javascript
// エラーログは自動的に即座フラッシュされます
customLogger.error('重要なエラー', { critical: true });

// 手動でログをフラッシュ
await customLogger.flush();
```

### ログファイルの確認

```javascript
// ログレベルの確認
const level = customLogger.getLevel();
console.log('現在のログレベル:', level);

// ログファイル一覧の取得
const logFiles = customLogger.getLogFiles();
console.log('ログファイル:', logFiles);
```

## コマンドラインツール

### ログ機能テスト

```bash
# 基本的なログテスト
cd studysphere-backend/backend/scripts
node test-logging.js

# ログファイル監視
node test-logging.js --monitor 60
```

### ログ管理ツール

```bash
# ログファイル一覧
node log-manager.js list

# ログファイル内容表示
node log-manager.js show combined.log

# ログファイル末尾表示
node log-manager.js tail error.log 20

# ログファイル検索
node log-manager.js search combined.log "PDF"

# 古いログファイル削除
node log-manager.js clean 7

# ログ統計情報
node log-manager.js stats

# ログファイル監視
node log-manager.js monitor 120

# ログ機能テスト
node log-manager.js test

# ヘルプ表示
node log-manager.js help
```

## ログファイルの構造

### ディレクトリ構造
```
logs/
├── 2025/
│   ├── 01/
│   │   ├── 15/
│   │   │   ├── combined.log      # 全ログ
│   │   │   ├── error.log         # エラーログ
│   │   │   ├── debug.log         # デバッグログ（開発環境）
│   │   │   ├── exceptions.log    # 例外ログ
│   │   │   └── rejections.log    # Promise拒否ログ
│   │   └── ...
│   └── ...
└── ...
```

### ログファイルの特徴
- **combined.log**: 全レベルのログを記録
- **error.log**: エラーレベルのログのみ記録
- **debug.log**: デバッグレベルのログ（開発環境のみ）
- **exceptions.log**: 未処理例外の詳細
- **rejections.log**: Promise拒否の詳細

## 設定可能なパラメータ

### 環境変数
```bash
# ログレベル設定
LOG_LEVEL=debug|info|warn|error

# 環境設定
NODE_ENV=development|production
```

### ログ設定
- **ログレベル**: info（デフォルト）
- **ファイルサイズ制限**: 5MB
- **ファイル保持数**: 5ファイル
- **ログローテーション**: 日次
- **クリーンアップ**: 30日

## トラブルシューティング

### よくある問題と対処法

#### 1. ログファイルが作成されない
```bash
# ログディレクトリの権限確認
node log-manager.js test

# ログディレクトリの権限修正
chmod -R 755 logs/
```

#### 2. ログが記録されない
```bash
# ログレベル確認
node log-manager.js stats

# ログ機能テスト
node log-manager.js test
```

#### 3. ログファイルが大きすぎる
```bash
# 古いログファイル削除
node log-manager.js clean 7

# ログ統計確認
node log-manager.js stats
```

#### 4. 特定のログを検索したい
```bash
# キーワード検索
node log-manager.js search combined.log "PDF"

# ファイル末尾確認
node log-manager.js tail error.log 50
```

## 監視とメンテナンス

### 定期的なメンテナンス
- **日次**: ログファイルサイズの確認
- **週次**: 古いログファイルのクリーンアップ
- **月次**: ログ設定の見直し

### ログ監視の自動化
```bash
# 5分間隔でログ監視
node log-manager.js monitor 300

# ログファイルの自動クリーンアップ（cron）
0 2 * * 0 cd /path/to/backend && node scripts/log-manager.js clean 30
```

## パフォーマンスへの影響

### ログ記録のオーバーヘッド
- **基本ログ**: 1-5ms
- **ファイルログ**: 5-20ms
- **エラーログ**: 10-30ms
- **即座フラッシュ**: 追加5-15ms

### 最適化のポイント
- 本番環境では適切なログレベルの設定
- 不要なデバッグログの削減
- ログファイルサイズの適切な管理

## 今後の改善予定

### 短期
- ログの圧縮機能
- ログの暗号化機能
- ログのバックアップ機能

### 長期
- 分散ログ収集システム
- ログ分析・可視化ツール
- アラート機能の実装

## 注意事項

1. **ログレベル**: 本番環境では適切なレベルを設定
2. **ファイルサイズ**: 定期的なクリーンアップが必要
3. **権限管理**: ログディレクトリの適切な権限設定
4. **パフォーマンス**: 過度なログ記録は避ける

## サポート

問題が発生した場合は、以下の情報を収集して報告してください：

1. ログファイルの内容
2. ログ管理ツールの出力
3. エラーメッセージ
4. 環境設定情報
5. 実行したコマンド
