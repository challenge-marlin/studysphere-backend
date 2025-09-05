# StudySphere 開発環境起動ガイド

## 概要

このディレクトリには、StudySphere開発環境を起動・停止するためのスクリプトが含まれています。

## 推奨起動方法

### 🚀 メイン起動スクリプト: `start-all.bat`

**最も推奨される起動方法です。**

```bash
# 基本的な起動（ヘルスチェック付き）
start-all.bat

# クイック起動（ヘルスチェックなし）
start-all.bat quick

# コンテナ再作成
start-all.bat recreate

# イメージ再ビルド + コンテナ再作成
start-all.bat rebuild
```

#### 起動モード

1. **Normal (デフォルト)**: 完全なヘルスチェック付き起動
2. **Quick**: 高速起動（ヘルスチェックなし）
3. **Recreate**: コンテナを強制再作成
4. **Rebuild**: イメージを再ビルドしてから起動

#### 特徴

- ✅ Docker Compose自動検出（plugin/legacy対応）
- ✅ データベース接続確認
- ✅ バックエンドヘルスチェック
- ✅ 管理者アカウント自動作成
- ✅ 詳細な進捗表示
- ✅ エラーハンドリング

### 🛑 停止スクリプト: `stop-all.bat`

```bash
stop-all.bat
```

- すべてのサービスを安全に停止
- Docker Compose両バージョン対応

## 従来のスクリプト（非推奨）

### `start-backend.bat` (非推奨)

**注意**: このスクリプトは非推奨です。`start-all.bat`に自動的にリダイレクトされます。

```bash
start-backend.bat  # start-all.bat default にリダイレクト
```

## 前提条件

### Docker Desktop

- Docker Desktopが起動している必要があります
- スクリプト実行前にDocker Desktopを起動してください

### ポート

以下のポートが利用可能である必要があります：
- **5000**: バックエンドAPI
- **3307**: MySQLデータベース

## 起動手順

1. **Docker Desktop起動**
   ```bash
   # Docker Desktopを起動
   ```

2. **開発環境起動**
   ```bash
   cd studysphere-backend
   start-all.bat
   ```

3. **起動完了確認**
   - バックエンド: http://localhost:5000
   - データベース: localhost:3307
   - 管理者ログイン: admin001 / admin123

## トラブルシューティング

### よくある問題

#### Dockerが起動していない
```
[ERROR] Docker is not running. Please start Docker Desktop first.
```
**解決方法**: Docker Desktopを起動してください

#### ポートが使用中
```
[ERROR] Port 5000 is already in use
```
**解決方法**: 
```bash
# 既存のサービスを停止
stop-all.bat

# または、使用中のプロセスを確認
netstat -ano | findstr :5000
```

#### データベース接続エラー
```
[ERROR] Database connection failed
```
**解決方法**:
```bash
# サービスを再起動
stop-all.bat
start-all.bat

# ログを確認
docker compose logs db
```

### ログ確認

```bash
# 全サービスのログ
docker compose logs -f

# 特定サービスのログ
docker compose logs -f backend
docker compose logs -f db

# サービス状態確認
docker compose ps
```

## 開発者向け情報

### 環境変数

- `DB_HOST`: データベースホスト（Docker環境では`db`）
- `DB_USER`: データベースユーザー（デフォルト: `root`）
- `DB_PASSWORD`: データベースパスワード
- `DB_NAME`: データベース名（デフォルト: `curriculum-portal`）
- `DB_PORT`: データベースポート（デフォルト: `3306`）

### カスタマイズ

`docker-compose.yml`を編集することで、設定をカスタマイズできます：

- ポート番号の変更
- 環境変数の追加
- ボリュームの設定
- ネットワークの設定

## サポート

問題が発生した場合は、以下を確認してください：

1. Docker Desktopの状態
2. ポートの使用状況
3. ログファイル（`backend/logs/`）
4. このREADMEファイル

追加のサポートが必要な場合は、開発チームにお問い合わせください。
