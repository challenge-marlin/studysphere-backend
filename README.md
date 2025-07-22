# カリキュラムポータル 開発環境

## 概要

カリキュラムポータルの開発環境です。Docker Compose を使用して MySQL と Node.js アプリケーションを管理します。

## 前提条件

- Docker
- Docker Compose

## セットアップ

### 1. 環境の起動（推奨）

```bash
# 初回起動（データベースとバックエンドが自動起動）
docker-compose up -d

# 2回目以降の起動（既存データを保持）
docker-compose up -d
```

### 2. 個別起動

```bash
# データベースのみ起動
docker-compose up -d db

# バックエンドのみ起動（データベースが起動している場合）
docker-compose up -d backend
```

### 3. ログの確認

```bash
# 全サービスのログ
docker-compose logs -f

# バックエンドのログのみ
docker-compose logs -f backend

# データベースのログのみ
docker-compose logs -f db
```

### 4. データベースの管理

#### データベースの初期化（既存データを保持）

```bash
./scripts/init-db.sh
```

#### データベースのリセット（既存データを削除）

```bash
./scripts/init-db.sh --reset
```

#### データベースの停止

```bash
docker-compose down
```

#### データベースの完全削除（ボリュームも削除）

```bash
docker-compose down -v
```

## アクセス情報

### バックエンド API

- **URL**: http://localhost:3000
- **ヘルスチェック**: http://localhost:3000/
- **管理者ログイン**: POST http://localhost:3000/login

### データベース

- **Host**: localhost
- **Port**: 3307
- **Database**: curriculum-portal
- **Username**: root
- **Password**: shinomoto926!

## 開発時の注意事項

### 自動起動の仕組み

- `docker-compose up -d`で MySQL とバックエンドが同時に起動
- バックエンドはデータベースの準備が完了してから起動
- ホットリロード対応（コード変更時に自動再起動）

### データの永続化

- 通常の`docker-compose up -d`では既存データは保持されます
- `init.sql`は初回起動時のみ実行されます
- データをリセットしたい場合は`./scripts/init-db.sh --reset`を使用してください

### データベースの変更

- スキーマを変更した場合は、`./scripts/init-db.sh --reset`でリセットしてください
- サンプルデータを追加したい場合は、`db/init.sql`を編集してください

### トラブルシューティング

#### ポート競合エラー

```bash
# 既存のMySQLプロセスを停止
sudo service mysql stop
# または
sudo systemctl stop mysql
```

#### バックエンドが起動しない場合

```bash
# ログを確認
docker-compose logs backend

# コンテナを再起動
docker-compose restart backend
```

#### データベース接続エラー

```bash
# コンテナの状態を確認
docker-compose ps

# データベースの準備状況を確認
docker-compose logs db
```

#### データベースのリセットが必要な場合

```bash
# 完全にリセット
docker-compose down -v
docker-compose up -d
```

## ファイル構成

```
my-app/
├── docker-compose.yml      # Docker Compose設定
├── db/
│   └── init.sql           # データベース初期化SQL
├── backend/               # Node.jsアプリケーション
│   ├── index.js          # メインエントリーポイント
│   ├── app.js            # Expressアプリケーション設定
│   ├── config/           # 設定ファイル
│   ├── utils/            # ユーティリティ
│   ├── middleware/       # ミドルウェア
│   ├── scripts/          # ビジネスロジック
│   └── Dockerfile        # バックエンドコンテナ設定
├── scripts/
│   └── init-db.sh        # データベース管理スクリプト
└── README.md             # このファイル
```

## 開発ワークフロー

1. **初回セットアップ**

   ```bash
   docker-compose up -d
   ```

2. **日常的な開発**

   ```bash
   # 起動
   docker-compose up -d

   # 停止
   docker-compose down

   # ログ確認
   docker-compose logs -f backend
   ```

3. **データベースの変更時**

   ```bash
   # スキーマ変更後
   ./scripts/init-db.sh --reset
   ```

4. **サンプルデータの追加**

   ```bash
   # init.sqlを編集後
   ./scripts/init-db.sh
   ```

5. **バックエンドコードの変更**
   ```bash
   # ホットリロードで自動再起動
   # 手動で再起動する場合
   docker-compose restart backend
   ```
