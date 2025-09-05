# PDF処理とAIサポート制御の統合機能

## 概要

この機能は、現在のセクション（学習中の部分）のテキストがPDFの場合、AIサポート送信時に自動的にTXTに変換し、その内容に基づいてAI回答を生成する仕組みを提供します。

**重要な特徴**: 
- 学習画面はPDF→TXT変換が完了していなくても表示されます
- AIサポート送信時に、現在のセクションのPDFファイルが自動的にTXTに変換されます
- 変換されたテキスト内容に基づいてAI回答が生成されます
- レッスン全部ではなく、現在のセクションのテキストのみを処理します

## アーキテクチャ

### 1. PDF処理スクリプト (`pdfProcessor.js`)
- PDF→TXT変換処理の実行
- 処理状態の管理（進行中、完了、エラー、キャンセル）
- 非同期処理によるバックグラウンド実行
- 複数ユーザーの処理状態分離

### 2. PDF処理コントローラー (`pdfController.js`)
- PDFファイルアップロード・処理開始
- 処理状態確認
- 処理結果取得
- 処理キャンセル

### 3. PDF処理ルート (`pdfRoutes.js`)
- `/api/pdf/upload` - PDFアップロード・処理開始
- `/api/pdf/status/:processId` - 処理状態確認
- `/api/pdf/user-status` - ユーザーの処理状態一覧
- `/api/pdf/result/:processId` - 処理結果取得
- `/api/pdf/stats` - 処理統計（管理者用）
- `/api/pdf/cancel/:processId` - 処理キャンセル

### 4. AIサポート制御 (`ai.js`)
- PDF処理状態チェックによる送信制御
- `/api/ai/pdf-status/:userId` - PDF処理状態確認エンドポイント

## 処理フロー

```
1. 現在のセクションにPDFファイルが設定される
   ↓
2. ユーザーがAIサポートに質問を送信（lessonIdを指定）
   ↓
3. システムが現在のセクションのPDFファイルをS3から取得
   ↓
4. PDFファイルをTXTに変換（バックグラウンド処理）
   ↓
5. 変換されたテキスト内容に基づいてAI回答を生成
   ↓
6. ユーザーに回答を返却
```

## API エンドポイント

### PDF処理関連

#### PDFアップロード・処理開始
```http
POST /api/pdf/upload
Content-Type: multipart/form-data

{
  "pdf": [PDFファイル],
  "userToken": "ユーザートークン"
}
```

#### 処理状態確認
```http
GET /api/pdf/status/:processId?userToken=ユーザートークン
```

#### ユーザーの処理状態一覧
```http
GET /api/pdf/user-status?userToken=ユーザートークン
```

#### 処理結果取得
```http
GET /api/pdf/result/:processId?userToken=ユーザートークン
```

#### 処理キャンセル
```http
POST /api/pdf/cancel/:processId
Content-Type: application/json

{
  "userToken": "ユーザートークン"
}
```

### AIサポート制御関連

#### PDF処理状態確認（AIサポート送信可否）
```http
GET /api/ai/pdf-status/:userId
Authorization: Bearer [JWTトークン]
```

#### 現在のセクションテキスト取得（PDFの場合はTXTに変換）
```http
GET /api/ai/section-text/:lessonId
Authorization: Bearer [JWTトークン]
```

#### AIサポート送信（セクションPDF自動変換付き）
```http
POST /api/ai/assist
Authorization: Bearer [JWTトークン]
Content-Type: application/json

{
  "question": "質問内容",
  "lessonId": "レッスンID",  // lessonIdを指定すると現在のセクションのPDFを自動的にTXTに変換
  "context": "テキスト内容", // contextとlessonIdの両方を指定した場合、lessonIdが優先
  "userId": "ユーザーID",
  ...その他のパラメータ
}
```

## 処理状態

### 状態一覧
- `processing`: 処理中
- `completed`: 処理完了
- `error`: エラー発生
- `cancelled`: ユーザーによるキャンセル

### 進捗管理
- 0%: 処理開始
- 10%: ファイルサイズチェック完了
- 80%: PDFテキスト抽出完了
- 100%: 後処理完了

## 制限事項

### ファイルサイズ
- 最大100MBまで対応
- 超過時はエラーメッセージを返却

### 処理時間
- 最大4分のタイムアウト設定
- タイムアウト時はエラー状態に移行

### テキスト長
- 抽出されたテキストは最大1MBまで
- 超過時は切り詰め処理を実行

## エラーハンドリング

### よくあるエラー
1. **ファイルサイズ超過**
   - エラー: `PDFファイルサイズが大きすぎます（100MB以下にしてください）`

2. **処理タイムアウト**
   - エラー: `PDF処理がタイムアウトしました`

3. **AIサポート送信制限**
   - エラー: `PDF処理が完了していません。処理完了までAIサポートへの送信はできません。`

4. **権限エラー**
   - エラー: `この処理状態にアクセスする権限がありません`

## セキュリティ

### 認証・認可
- ユーザートークンによる認証
- ユーザーIDによる処理状態の分離
- 管理者権限による統計情報アクセス制御

### ファイル検証
- PDFファイル形式の検証
- ファイルサイズの制限
- マルチパートアップロードの安全な処理

## パフォーマンス

### 非同期処理
- PDF処理はバックグラウンドで実行
- ユーザーは処理完了まで待機不要
- 処理状態のリアルタイム監視が可能

### メモリ管理
- ファイルはメモリ上で処理
- 処理完了後の自動クリーンアップ
- 24時間経過した古い処理状態の自動削除

## テスト

### 統合テスト
```bash
cd studysphere-backend/backend/scripts
node test-pdf-ai-integration.js
```

### 個別テスト
```bash
# PDF処理テスト
node test-pdf-processing.js

# 統合テスト
node test-pdf-ai-integration.js
```

## 運用

### ログ監視
- PDF処理の開始・完了・エラーをログ出力
- 処理時間・ファイルサイズ・テキスト長の記録
- エラー発生時の詳細情報の記録

### 統計情報
- 処理中のPDF数
- 完了済みのPDF数
- エラー発生数
- 総処理数

### クリーンアップ
- 1時間ごとの古い処理状態の自動削除
- 24時間経過した処理状態の削除

## トラブルシューティング

### よくある問題

1. **PDF処理が完了しない**
   - ファイルサイズを確認（100MB以下）
   - 処理時間を確認（最大4分）
   - ログでエラー詳細を確認

2. **AIサポート送信ができない**
   - PDF処理状態を確認
   - ユーザーIDが正しく設定されているか確認
   - 処理完了まで待機

3. **ファイルアップロードエラー**
   - ファイル形式がPDFか確認
   - ファイルサイズを確認
   - ユーザートークンの有効性を確認

### デバッグ方法

1. **ログ確認**
   ```bash
   tail -f logs/application.log | grep "PDF"
   ```

2. **処理状態確認**
   ```bash
   curl "http://localhost:5050/api/pdf/user-status?userToken=ユーザートークン"
   ```

3. **統計情報確認**
   ```bash
   curl "http://localhost:5050/api/pdf/stats?userToken=管理者トークン"
   ```

## 今後の拡張

### 予定機能
- バッチ処理による大量PDFの一括処理
- 処理結果の永続化（データベース保存）
- 処理履歴の管理
- 処理優先度の設定

### 技術的改善
- ワーカープロセスによる並列処理
- キャッシュ機能による処理速度向上
- 分散処理によるスケーラビリティ向上
