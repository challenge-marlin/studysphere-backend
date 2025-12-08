# StudySphere 起動ガイド

## 概要
StudySphereの開発環境を起動するためのスクリプトが用意されています。

## 起動方法

### 1. データベースの起動
```bash
# データベースのみを起動
start-database.bat
```

### 2. バックエンドの起動
```bash
# バックエンドサーバーを起動
start-all.bat
```

### 3. フロントエンドの起動
```bash
# フロントエンドディレクトリに移動
cd studysphere-frontend

# フロントエンドサーバーを起動
start-frontend.bat
```

## 停止方法

### すべてのサービスを停止
```bash
# すべてのサービスを停止
stop-all.bat
```

## サービス情報

### データベース
- **ホスト**: localhost
- **ポート**: 3307
- **ユーザー名**: root
- **パスワード**: shinomoto926!
- **データベース名**: curriculum-portal

### バックエンド
- **URL**: http://localhost:5050
- **ヘルスチェック**: http://localhost:5050/health

### フロントエンド
- **URL**: http://localhost:3000
- **API URL**: http://localhost:5050

## 管理者ログイン情報
- **ID**: admin001
- **パスワード**: admin123
- **ロール**: 10 (Administrator)

## トラブルシューティング

### データベース接続エラー
1. Docker Desktopが起動していることを確認
2. `start-database.bat`を実行してデータベースを起動
3. データベースが起動するまで待機（約30秒）

### バックエンド接続エラー
1. データベースが起動していることを確認
2. `start-all.bat`を実行してバックエンドを起動
3. バックエンドが起動するまで待機（約10秒）

### フロントエンド接続エラー
1. バックエンドが起動していることを確認
2. `start-frontend.bat`を実行してフロントエンドを起動
3. フロントエンドが起動するまで待機（約30秒）

## ログファイル
- **起動ログ**: `logs/YYYY/MM/DD/startup.log`
- **エラーログ**: `logs/YYYY/MM/DD/startup-errors.log`
- **ビルドログ**: `logs/YYYY/MM/DD/build.log`

## 注意事項
- 初回起動時は依存関係のインストールに時間がかかります
- データベースの起動には約30秒かかります
- フロントエンドの起動には約30秒かかります
- すべてのサービスが起動するまで待機してからアクセスしてください
