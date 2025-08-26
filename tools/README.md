# Tools Directory

このディレクトリには、開発・テスト・デバッグ用のスクリプトが含まれています。

## データベース関連

### 接続・構造確認
- `test-db-connection.js` - データベース接続テストとテーブル構造確認
- `check-table-structure.js` - テーブル構造の詳細確認とinstructor_commentフィールド追加

### テストデータ作成
- `create-test-data.js` - 完全なテストデータ作成（全フィールド）
- `create-test-data-fixed.js` - 修正版テストデータ作成（conditionフィールド対応）
- `create-test-data-simple.js` - シンプルなテストデータ作成（最小限のフィールド）

## ユーザー・認証関連

### ユーザー確認
- `check-users.js` - ユーザー一覧の確認
- `check-user.js` - 特定ユーザーの詳細確認
- `test-login-api.js` - ログインAPIのテスト
- `test-login-simple.js` - シンプルなログインテスト
- `test-password.js` - パスワード関連のテスト
- `reset-password.js` - パスワードリセット

### 一時パスワード関連
- `check-temp-password-db.js` - 一時パスワードテーブルの確認
- `test-temp-password.js` - 一時パスワード機能のテスト

## 管理者・権限関連

### 管理者確認・設定
- `check-manager-ids.js` - 管理者IDの確認
- `test-manager-ids.js` - 管理者IDのテスト
- `debug-manager-ids.js` - 管理者IDのデバッグ
- `fix-manager-ids.js` - 管理者IDの修正
- `set-current-user-as-manager.js` - 現在のユーザーを管理者に設定
- `set-morinai-as-manager.js` - 特定ユーザーを管理者に設定

### 拠点・企業関連
- `check-satellite2-manager.js` - 拠点管理者の確認
- `checkSatelliteManagers.js` - 拠点管理者の詳細確認
- `check-companies.js` - 企業情報の確認

## デバッグ・トラブルシューティング

### ユーザー情報デバッグ
- `debug-user-info.js` - ユーザー情報のデバッグ
- `debug-user-info-fixed.js` - 修正版ユーザー情報デバッグ

## S3・外部サービス関連

### S3設定確認
- `check-s3-env.js` - S3環境変数の確認
- `test-s3-config.js` - S3設定のテスト

## 使用方法

### 基本的な実行方法
```bash
# データベース接続テスト
node tools/test-db-connection.js

# テストデータ作成
node tools/create-test-data-simple.js

# ユーザー確認
node tools/check-users.js
```

### 注意事項
- 本番環境で実行する前に、必ず開発環境でテストしてください
- データベースを変更するスクリプトは、バックアップを取ってから実行してください
- 管理者権限を変更するスクリプトは、慎重に実行してください

## スクリプトの追加

新しいスクリプトを追加する場合は、このREADMEファイルも更新してください。
