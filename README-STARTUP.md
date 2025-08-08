# StudySphere 開発環境起動ガイド

## 概要
このガイドでは、StudySphere開発環境の安全で安定した起動方法を説明します。

## 新しい起動方法（推奨）

### 1. サービス起動
```bash
start-all.bat
```
- シンプルで安全な起動処理
- ハングやウィンドウ落ちを防止
- サービスをバックグラウンドで起動

### 2. ステータス確認
```bash
check-status.bat
```
- サービスの稼働状況を確認
- MySQLとバックエンドの準備状況をチェック
- 最近のログを表示

### 3. ログ表示
```bash
show-logs.bat
```
- リアルタイムでログを表示
- Ctrl+Cで安全に停止

### 4. サービス停止
```bash
stop-all.bat
```
- 安全にサービスを停止
- リソースを適切にクリーンアップ

## 使用方法

1. **起動**: `start-all.bat` を実行
2. **確認**: `check-status.bat` で準備状況を確認
3. **使用**: ブラウザで http://localhost:5000 にアクセス
4. **停止**: 作業終了後に `stop-all.bat` を実行

## トラブルシューティング

### サービスが起動しない場合
1. Docker Desktopが起動していることを確認
2. Docker Desktopに十分なリソース（4GB RAM、2 CPU）が割り当てられていることを確認
3. `check-status.bat` で詳細な状況を確認

### ログの確認
```bash
show-logs.bat
```
または
```bash
docker compose logs -f
```

### 強制再起動
```bash
docker compose down
docker compose up -d
```

## 管理者ログイン情報
- **ID**: admin001
- **パスワード**: admin123

## 注意事項
- 初回起動時は、サービスが完全に準備できるまで数分かかる場合があります
- サービスはバックグラウンドで動作するため、起動後は `check-status.bat` で準備状況を確認してください
- 作業終了時は必ず `stop-all.bat` でサービスを停止してください
