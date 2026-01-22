# レッスンステータス一括更新スクリプト

完了とすべきレッスンのステータスを一括で `completed` に更新するスクリプトです。

## 概要

現在 `in_progress` のままになっているが、実際には完了条件を満たしているレッスンを抽出し、ステータスを `completed` に更新します。

## 完了条件

### 提出物がないレッスン（has_assignment = FALSE）
- `test_score >= 29` かつ `instructor_approved = TRUE`

### 提出物があるレッスン（has_assignment = TRUE）
- `test_score >= 29` かつ `instructor_approved = TRUE` (テスト承認済み)
- かつ `assignment_submitted = TRUE` (提出物提出済み)

## 使用方法

### 1. 抽出のみ実行（DRY-RUNモード）

まず、完了とすべきレッスンを抽出して確認します。このモードではデータベースは更新されません。

```bash
cd studysphere-backend
node scripts/update-lesson-status-to-completed.js
```

または明示的に：

```bash
node scripts/update-lesson-status-to-completed.js --dry-run
```

### 2. 実際に更新を実行

抽出結果を確認した後、実際にデータベースを更新する場合は `--execute` オプションを付けます。

```bash
node scripts/update-lesson-status-to-completed.js --execute
```

## 出力内容

### コンソール出力

1. **完了とすべきレッスン一覧**（詳細形式）
   - ユーザー名、ログインコード
   - レッスン名、レッスンID
   - テストスコア
   - 指導員承認状況
   - 提出物状況
   - 現在のステータス

2. **CSV形式**（コピー用）
   - Excelなどに貼り付けて確認可能な形式

3. **更新結果**
   - 成功件数
   - 失敗件数（エラーが発生した場合）

### ログ出力

詳細なログは `backend/logs/` ディレクトリに出力されます。

## 実行例

### DRY-RUNモード（抽出のみ）

```bash
$ node scripts/update-lesson-status-to-completed.js

【DRY-RUNモード】抽出のみ実行します（更新は行いません）
実際に更新する場合は、--execute オプションを付けて実行してください。

=== 完了とすべきレッスン一覧 ===
1. ユーザー: 山田太郎 (USER-0001-0001)
   レッスン: 第1回　Windows11の基本操作とソフトウェアの活用 (ID: 1)
   テストスコア: 29
   指導員承認: 済み
   提出物: なし
   現在のステータス: in_progress

...

【DRY-RUNモード】抽出のみ実行しました。実際の更新は行いませんでした。
実際に更新する場合は、--execute オプションを付けて実行してください。
```

### 実行モード（実際に更新）

```bash
$ node scripts/update-lesson-status-to-completed.js --execute

【実行モード】実際にデータベースを更新します。

=== 完了とすべきレッスン一覧 ===
...

=== 更新完了 ===
成功: 15件
失敗: 0件

スクリプトが正常に完了しました
```

## 注意事項

1. **バックアップ推奨**: 実行前にデータベースのバックアップを取得することを推奨します。

2. **DRY-RUNモードで確認**: 必ず最初にDRY-RUNモードで抽出結果を確認してから、実際の更新を実行してください。

3. **コース進捗率の自動更新**: レッスンのステータスを更新すると、関連するコースの進捗率も自動的に再計算されます。

4. **トランザクション**: 各レッスンの更新は個別のトランザクションで実行されるため、一部の更新が失敗しても他の更新には影響しません。

## トラブルシューティング

### エラーが発生した場合

1. ログファイル（`backend/logs/`）を確認してください。
2. データベース接続設定を確認してください（`.env` ファイル）。
3. 必要な権限があることを確認してください。

### 抽出結果が0件の場合

- 完了条件を満たすレッスンが存在しない可能性があります。
- SQLクエリの条件を確認してください。

## 関連ファイル

- `scripts/update-lesson-status-to-completed.js` - メインスクリプト
- `backend/scripts/learningController.js` - レッスン進捗管理ロジック
- `db/init.sql` - データベーススキーマ定義
