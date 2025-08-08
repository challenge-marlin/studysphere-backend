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

## データベースマイグレーション

サテライトテーブルに電話番号カラムを追加するマイグレーション：

```bash
# Windows (バッチファイル)
run-migration.bat

# Windows (PowerShell)
.\run-migration.ps1

# Linux/Mac
mysql -u root -p < db/add-phone-to-satellites.sql
```

**注意**: マイグレーション実行前にデータベースのバックアップを取ることを推奨します。

## Docker クリーンアップ

Dockerボリュームやキャッシュが蓄積された場合は、以下のスクリプトでクリーンアップできます：

### 自動クリーンアップ（推奨）
`start-all.bat`を実行すると、起動時に自動的に以下のクリーンアップが実行されます：
- Dangling images（`<none>`タグ）の削除
- 未使用のネットワークの削除
- 停止中コンテナの削除
- ビルドキャッシュの削除
- **データベースボリュームは保持**（既存データを保護）

### 手動クリーンアップ

#### 安全なクリーンアップ（StudySphere関連のみ）
```bash
# Windows (バッチファイル)
cleanup-docker-safe.bat

# Windows (PowerShell)
.\cleanup-docker-safe.ps1
```

#### 包括的なクリーンアップ（全未使用リソース）
```bash
# Windows (バッチファイル)
cleanup-docker.bat

# Windows (PowerShell)
.\cleanup-docker.ps1
```

#### 完全クリーンアップ（DBデータも含む）
```bash
# Windows (バッチファイル)
cleanup-docker-full.bat

# Windows (PowerShell)
.\cleanup-docker-full.ps1
```

**注意**: 包括的なクリーンアップは他のDockerプロジェクトにも影響する可能性があります。
**警告**: 完全クリーンアップは**全てのStudySphereデータを削除**します。実行前に必ずバックアップを取ってください。

### クリーンアップ対象
- **Dangling Images**: `<none>`タグのイメージ
- **未使用ボリューム**: どのコンテナからも参照されていないボリューム
- **未使用ネットワーク**: どのコンテナからも参照されていないネットワーク
- **停止中コンテナ**: 終了したコンテナ
- **ビルドキャッシュ**: Docker buildのキャッシュ

### クリーンアップ後の再起動
クリーンアップ後は、以下のコマンドで環境を再起動してください：
```bash
start-all.bat
```
