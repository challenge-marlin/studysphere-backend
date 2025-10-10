# MDファイルがPDFとして処理される問題の修正ガイド

## 問題の説明

エラーログ：
```
PDFファイルが見つかりません。S3キー: C1.1Windows 11 の基本操作とソフトウェアの活用.md
POST https://backend.studysphere.ayatori-inc.co.jp/api/learning/extract-pdf-text 404
```

**原因**: データベースの`lessons`テーブルで、MDファイルの`file_type`が`'md'`ではなく`'pdf'`や他の値になっている。

## 修正手順

### 方法1: SQLで一括修正（推奨）

1. **MySQL WorkbenchまたはHeidiSQLでデータベースに接続**

2. **問題のあるレッスンを確認**
   ```sql
   SELECT 
       id,
       title,
       s3_key,
       file_type
   FROM lessons
   WHERE status != 'deleted'
       AND s3_key LIKE '%.md'
       AND file_type != 'md'
   ORDER BY id;
   ```

3. **file_typeを修正**
   ```sql
   UPDATE lessons
   SET file_type = 'md',
       updated_at = CURRENT_TIMESTAMP
   WHERE status != 'deleted'
       AND s3_key LIKE '%.md'
       AND file_type != 'md';
   ```

4. **修正結果を確認**
   ```sql
   SELECT 
       id,
       title,
       s3_key,
       file_type,
       CASE 
           WHEN s3_key LIKE '%.md' AND file_type = 'md' THEN '正常 ✓'
           WHEN s3_key LIKE '%.pdf' AND file_type IN ('pdf', 'application/pdf') THEN '正常 ✓'
           ELSE '要確認 ✗'
       END as status
   FROM lessons
   WHERE status != 'deleted'
   ORDER BY id;
   ```

### 方法2: 個別に修正

特定のレッスンIDのみ修正する場合：

```sql
-- 例: レッスンID 1, 2, 3, 4, 5, 6 のfile_typeをmdに修正
UPDATE lessons
SET file_type = 'md',
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (1, 2, 3, 4, 5, 6)
    AND s3_key LIKE '%.md';
```

## 修正後の動作確認

### 1. ブラウザのキャッシュをクリア

Ctrl + Shift + Delete でキャッシュとCookieをクリア

### 2. ページをリロード

F5 または Ctrl + R

### 3. コンソールログを確認

開発者ツール（F12）→ Consoleタブで以下を確認：

**正常な場合：**
```
TextSection - lessonData.file_type: md
テキストファイルのコンテキストをセッションストレージに保存: {fileType: 'md', textLength: xxxxx, s3Key: 'xxx.md'}
```

**問題がある場合（修正前）：**
```
TextSection - lessonData.file_type: pdf
PDFテキスト抽出を開始します: xxx.md
POST https://backend.studysphere.ayatori-inc.co.jp/api/learning/extract-pdf-text 404
```

## トラブルシューティング

### ケース1: 修正後もエラーが出る

**原因**: ブラウザキャッシュが残っている

**対処**:
1. Ctrl + Shift + Delete でキャッシュクリア
2. ブラウザを完全に閉じて再起動
3. シークレットモード（Ctrl + Shift + N）で試す

### ケース2: file_typeは正しいのにエラーが出る

**原因**: セッションストレージに古いデータが残っている

**対処**:
1. 開発者ツール（F12）→ Applicationタブ
2. Session Storage → クリア
3. ページをリロード

### ケース3: 全レッスンのfile_typeを確認したい

```sql
SELECT 
    id,
    title,
    s3_key,
    file_type,
    CASE 
        WHEN s3_key LIKE '%.pdf' THEN 'PDF拡張子'
        WHEN s3_key LIKE '%.md' THEN 'MD拡張子'
        WHEN s3_key LIKE '%.txt' THEN 'TXT拡張子'
        ELSE 'その他'
    END as extension,
    CASE 
        WHEN (s3_key LIKE '%.pdf' AND file_type IN ('pdf', 'application/pdf')) THEN '一致 ✓'
        WHEN (s3_key LIKE '%.md' AND file_type = 'md') THEN '一致 ✓'
        WHEN (s3_key LIKE '%.txt' AND file_type = 'text/plain') THEN '一致 ✓'
        ELSE '不一致 ✗'
    END as consistency
FROM lessons
WHERE status != 'deleted'
ORDER BY id;
```

## 予防策

今後、レッスンファイルを更新する際は：

1. **管理画面からファイルをアップロード**
   - システムが自動的に正しい`file_type`を設定します

2. **直接SQLでデータを変更する場合**
   - 必ず`file_type`も正しい値に設定してください
   ```sql
   -- 例: MDファイルをアップロードした場合
   UPDATE lessons
   SET s3_key = 'xxx.md',
       file_type = 'md'  -- ← これを忘れずに！
   WHERE id = 1;
   ```

## 正しいfile_type値

| ファイル拡張子 | 正しいfile_type値 |
|--------------|------------------|
| .pdf | `'pdf'` または `'application/pdf'` |
| .md | `'md'` |
| .txt | `'text/plain'` |
| .rtf | `'application/rtf'` |

