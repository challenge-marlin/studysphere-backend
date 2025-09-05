# StudySphere Backend 仕様書

## 環境設定

### 環境変数ファイル
- バックエンドの`.env`ファイルは`/studysphere-backend`直下に配置されています
- 環境変数ファイルは`.gitignore`で除外されており、リポジトリには含まれません

### データベース設定
- MySQL 8.0を使用
- ポート: 3307 (ホストマシンからアクセス時)
- データベース名: `curriculum-portal`
- ルートパスワード: `shinomoto926!`

## 開発環境の制約

### PowerShell制約
- **PowerShellでは`&&`コマンドは使用できません**
- 複数のコマンドを実行する場合は、以下のいずれかの方法を使用してください：
  - セミコロン区切り: `command1; command2`
  - パイプライン: `command1 | command2`
  - 個別実行: コマンドを順次実行

### Docker環境
- Docker Composeを使用してサービスを管理
- バックエンドサービスは`studysphere-backend:latest`イメージを使用
- フロントエンドとバックエンドは分離して起動

## 起動方法

### 全サービス起動
```bash
# Windows (PowerShell)
.\start-all.bat

# Linux/macOS
./start-all.sh
```

### バックエンドのみ起動
```bash
# Windows (PowerShell)
.\start-backend.bat

# Linux/macOS
./start-backend.sh
```

### 個別サービス起動
```bash
# データベースのみ
docker-compose up db -d

# バックエンドのみ
docker-compose up backend -d
```

## トラブルシューティング

### よくある問題
1. **環境変数ファイルが存在しない**
   - `env-template.txt`を参考に`.env`ファイルを作成
   - データベース接続情報を正しく設定

2. **PowerShellでのコマンド実行エラー**
   - `&&`の代わりに`;`を使用
   - または個別にコマンドを実行

3. **データベース接続エラー**
   - MySQLコンテナの状態確認: `docker-compose ps`
   - ログ確認: `docker-compose logs db`

### ログ確認
```bash
# 全サービスのログ
docker-compose logs

# 特定サービスのログ
docker-compose logs backend
docker-compose logs db
```

## 技術スタック
- **バックエンド**: Node.js, Express
- **データベース**: MySQL 8.0
- **コンテナ**: Docker, Docker Compose
- **開発ツール**: Nodemon
- **認証**: JWT

## 注意事項
- 本番環境では環境変数を適切に設定してください
- データベースのパスワードは開発環境用です
- セキュリティ上の理由から、本番環境では強力なパスワードを使用してください
