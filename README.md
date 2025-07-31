# StudySphere Backend

StudySphereのバックエンドAPI（Node.js + Express + MySQL）

## 開発環境の起動

### 方法1: Docker Compose（推奨）
```bash
# バックエンドとDBを同時起動（ホットリロード有効）
docker-compose up -d

# ログを表示
docker-compose logs -f backend

# 停止
docker-compose down
```

### 方法2: スクリプトファイル
```bash
# Linux/Mac
./start-backend.sh

# Windows
start-backend.bat
```

### 方法3: 個別起動
```bash
# DBのみ起動
docker-compose up -d db

# バックエンドのみ起動（ローカル開発）
cd backend
npm run dev
```

## アクセス情報

- **Backend API**: http://localhost:5000
- **MySQL Database**: localhost:3307
  - ユーザー: `root`
  - パスワード: `shinomoto926!`
  - データベース: `curriculum-portal`

## ホットリロード機能

Docker環境でのホットリロードが有効になっています：

- **ファイル変更の監視**: `js`, `json`, `sql`ファイル
- **自動再起動**: コード変更時に自動的にサーバーが再起動
- **ボリュームマウント**: ローカルのコード変更がコンテナ内に即座に反映

## 管理者アカウント復元

データベース初期化後は、以下のエンドポイントで管理者アカウントを復元できます：

```bash
POST http://localhost:5000/restore-admin
```

復元されるアカウント：
- ユーザー名: `admin001`
- パスワード: `admin123`

## 開発用コマンド

```bash
# コンテナ内でコマンド実行
docker-compose exec backend npm run test

# データベースに接続
docker-compose exec db mysql -u root -p curriculum-portal

# ログ確認
docker-compose logs backend
docker-compose logs db
```

## Docker クリーンアップ

Dockerボリュームやキャッシュが蓄積された場合は、以下のスクリプトでクリーンアップできます：

### 安全なクリーンアップ（データ保持）
```bash
# PowerShell
.\cleanup-docker-safe.ps1

# バッチファイル
cleanup-docker.bat
```

### 完全クリーンアップ（データ削除）
```bash
# PowerShell
.\cleanup-docker.ps1
```

### 手動クリーンアップ
```bash
# ビルドキャッシュのみ削除
docker builder prune -f

# 未使用のイメージを削除
docker image prune -f

# 未使用のボリュームを削除
docker volume prune -f

# システム全体のクリーンアップ
docker system prune -f
```

**注意**: `cleanup-docker.ps1`は全てのデータを削除するため、重要なデータがある場合は`cleanup-docker-safe.ps1`を使用してください。
