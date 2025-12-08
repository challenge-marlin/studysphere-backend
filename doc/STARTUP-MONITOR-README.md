# StudySphere Startup Monitor

## 概要

StudySphere Startup Monitorは、start-all.batで起動されるサービスの起動プロセスを監視し、異常を検出してログに記録するスクリプトです。

## 機能

### 1. 起動プロセス監視
- Docker Compose起動の監視
- 各サービスの起動状態の追跡
- プロセスの標準出力・標準エラーの記録

### 2. ヘルスチェック
- データベース接続の確認
- バックエンドAPIの応答確認
- サービス準備完了の待機

### 3. メモリ使用量監視
- リアルタイムメモリ使用量の追跡
- 高メモリ使用量の警告
- メモリリークの検出

### 4. 包括的なログ記録
- 起動プロセスの各段階の記録
- エラーと警告の詳細な記録
- タイムスタンプ付きの構造化ログ

## 使用方法

### 自動実行
start-all.batを実行すると、通常モード（default）の場合に自動的に起動監視スクリプトが実行されます。

### 手動実行
```bash
cd studysphere-backend
node startup-monitor.js
```

### 独立した監視
```javascript
const StartupMonitor = require('./startup-monitor');

const monitor = new StartupMonitor();

// Docker Compose起動の監視
await monitor.monitorDockerCompose();

// 起動完了を待機
await monitor.waitForStartup();

// 監視の停止
monitor.stop();
```

## ログファイル

### 生成されるログファイル
- `logs/startup-monitor.log` - 起動監視の全ログ
- `logs/startup-monitor-errors.log` - エラーログのみ
- `logs/startup.log` - Docker Compose起動ログ
- `logs/build.log` - イメージビルドログ
- `logs/db-error.log` - データベースエラーログ
- `logs/backend-error.log` - バックエンドエラーログ
- `logs/admin-setup.log` - 管理者アカウント設定ログ
- `logs/service-status.log` - サービス状態ログ

### ログフォーマット
```
[2024-01-15T10:30:45.123Z] INFO: Startup Monitor initialized {"startTime":"2024-01-15T10:30:45.123Z"}
[2024-01-15T10:30:45.456Z] INFO: Starting Docker Compose monitoring {"composeFile":"docker-compose.yml"}
```

## 設定

### 環境変数
- `NODE_ENV` - 環境設定（development/production）
- `LOG_LEVEL` - ログレベル設定

### タイムアウト設定
- Docker Compose起動タイムアウト: 5分
- データベースヘルスチェック間隔: 5秒
- バックエンドヘルスチェック間隔: 5秒
- メモリ監視間隔: 30秒

## トラブルシューティング

### よくある問題

#### 1. Node.jsが利用できない
```
[WARN] Node.js not available, skipping startup monitoring
```
**解決方法**: Node.jsをインストールするか、PATHに追加してください。

#### 2. 起動監視スクリプトが起動しない
- Node.jsのバージョンを確認
- スクリプトファイルの権限を確認
- 依存関係のインストールを確認

#### 3. ログファイルが生成されない
- `logs`ディレクトリの書き込み権限を確認
- ディスク容量を確認
- アプリケーションの起動ログを確認

### デバッグモード
詳細なデバッグ情報を表示するには：
```bash
NODE_ENV=development node startup-monitor.js
```

## 監視項目

### 1. プロセス監視
- プロセスID（PID）の追跡
- プロセス終了コードの記録
- シグナルによる終了の検出

### 2. サービスヘルスチェック
- データベース接続テスト
- HTTP API応答確認
- サービス準備完了の検証

### 3. リソース監視
- メモリ使用量の追跡
- CPU使用率の監視
- ディスクI/Oの監視

### 4. エラー検出
- 起動エラーの自動検出
- タイムアウトエラーの検出
- 依存関係エラーの検出

## パフォーマンス

### メモリ使用量
- 基本監視: ~10-20MB
- 詳細監視: ~30-50MB
- 長時間監視: ~50-100MB

### CPU使用率
- 通常時: 1-5%
- ヘルスチェック時: 5-15%
- エラー処理時: 10-20%

## セキュリティ

### ログファイルの保護
- 機密情報の自動フィルタリング
- ログファイルのアクセス制御
- 古いログファイルの自動削除

### プロセス制御
- 監視対象プロセスの制限
- 権限の最小化
- セキュアなプロセス間通信

## 拡張性

### カスタムヘルスチェック
```javascript
// カスタムヘルスチェック関数の追加
monitor.addHealthCheck('custom-service', async () => {
  // カスタムチェックロジック
  return { healthy: true, details: {} };
});
```

### プラグインシステム
```javascript
// プラグインの登録
monitor.registerPlugin('custom-plugin', {
  onStartup: () => console.log('Custom plugin started'),
  onShutdown: () => console.log('Custom plugin stopped')
});
```

## サポート

### ログの確認
問題が発生した場合は、まずログファイルを確認してください：
```bash
# エラーログの確認
tail -f logs/startup-monitor-errors.log

# 全ログの確認
tail -f logs/startup-monitor.log
```

### 問題の報告
問題を報告する際は、以下の情報を含めてください：
- エラーメッセージ
- ログファイルの内容
- 環境情報（OS、Node.jsバージョン等）
- 再現手順

## 更新履歴

### v1.0.0 (2024-01-15)
- 初回リリース
- 基本的な起動監視機能
- ヘルスチェック機能
- ログ記録機能

### 今後の予定
- メトリクス収集機能
- アラート機能
- Web UI
- 分散監視対応
