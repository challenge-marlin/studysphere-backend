# 現在受講中タグ移動問題の修正

## 問題の内容

既に学習中（`in_progress`）のレッスンの学習ボタンを押すと、「現在受講中」タグが移動しない問題がありました。

## 原因

既に `in_progress` のレッスンをクリックすると、同じステータスで更新を試みるため、MySQLが行の更新をスキップする可能性がありました。バックエンドで `updated_at = NOW()` を明示的に設定していても、MySQL側で最適化により更新がスキップされる場合がありました。

## 解決策

**強制更新メカニズム**を実装しました。

同じステータスへの更新の場合、以下のプロセスで確実に `updated_at` を更新します：

1. **ステータスを一時的に変更**: `in_progress` → `not_started`
2. **元のステータスに戻す**: `not_started` → `in_progress`

このプロセスにより、確実にDBの行が更新され、`updated_at` に新しいタイムスタンプが記録されます。

### フロントエンド側の変更

`studysphere-frontend/src/pages/LessonList.js` の `handleStartLesson` 関数を修正：

```javascript
body: JSON.stringify({
  userId: currentUser.id,
  lessonId: lesson.id,
  status: targetStatus,
  forceUpdate: true  // 強制更新フラグを追加
})
```

- `forceUpdate: true` フラグを追加し、バックエンドに強制更新を指示

### バックエンド側の変更

`studysphere-backend/backend/scripts/learningController.js` の `updateLessonProgress` 関数を修正：

```javascript
if (forceUpdate && existingProgress[0].status === status) {
  // 1回目: 一旦 not_started に変更
  await connection.execute(`
    UPDATE user_lesson_progress 
    SET status = 'not_started', updated_at = NOW()
    WHERE user_id = ? AND lesson_id = ?
  `, [userId, lessonId]);
  
  // 2回目: 元のステータスに戻しつつ、他のフィールドも更新
  await connection.execute(`
    UPDATE user_lesson_progress 
    SET status = ?, ..., updated_at = NOW()
    WHERE user_id = ? AND lesson_id = ?
  `, [status, ..., userId, lessonId]);
}
```

**処理の流れ：**
1. `forceUpdate` フラグと現在のステータスをチェック
2. 同じステータスの場合、一旦 `not_started` に変更
3. 元のステータスに戻しつつ、他のフィールド（testScore、assignmentSubmittedなど）も更新
4. 確実に `updated_at` が更新される

## 動作確認

1. バックエンドを再起動:
   ```bash
   cd studysphere-backend
   docker-compose restart backend
   ```

2. フロントエンドを再起動（開発環境の場合は自動リロード）

3. テスト手順:
   - 利用者としてログイン
   - コースを選択
   - 任意のレッスンの「学習」ボタンをクリック
   - 「現在受講中」タグがそのレッスンに移動することを確認
   - 別のレッスン（既に学習中のレッスン）をクリック
   - 「現在受講中」タグが新しいレッスンに確実に移動することを確認

## 技術的な詳細

### なぜ2回の UPDATE が必要なのか？

MySQLは、実際に値が変更されない UPDATE 文を最適化してスキップする場合があります。

例：
```sql
-- 既に status = 'in_progress' の場合
UPDATE user_lesson_progress 
SET status = 'in_progress', updated_at = NOW()
WHERE user_id = 1 AND lesson_id = 1;
-- → MySQLが「status は変わらない」と判断し、更新をスキップする可能性がある
```

これを防ぐため、以下のプロセスで確実に行を変更します：

```sql
-- 1回目: 必ず値が変わる
UPDATE user_lesson_progress 
SET status = 'not_started', updated_at = NOW()
WHERE user_id = 1 AND lesson_id = 1;
-- → status が変更されるため、必ず更新される

-- 2回目: 元に戻す
UPDATE user_lesson_progress 
SET status = 'in_progress', updated_at = NOW()
WHERE user_id = 1 AND lesson_id = 1;
-- → status が変更されるため、必ず更新される
```

### 現在受講中の判定ロジック

`getCurrentLesson` API は以下のクエリで最新のレッスンを取得します：

```sql
SELECT * FROM user_lesson_progress
WHERE user_id = ? AND status != 'not_started'
ORDER BY updated_at DESC, lesson_id DESC
LIMIT 1
```

- `updated_at DESC`: 最後に更新されたレッスンが「現在受講中」
- 確実に `updated_at` が更新されるため、正しく動作する

## パフォーマンス考慮

- `forceUpdate` は学習ボタンをクリックした時のみ実行されます
- 通常の進捗更新（テスト結果、課題提出など）では実行されません
- 2回の UPDATE が実行されますが、影響は最小限です

## 注意事項

- この修正は、ユーザーが1つずつレッスンをクリックする通常の使用パターンに最適化されています
- 複数のデバイスから同時にアクセスする場合は、最後に更新したものが「現在受講中」として表示されます
- トランザクション内で処理されるため、途中で失敗してもデータの整合性は保たれます

