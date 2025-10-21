# レッスンS3キー修正ガイド

## 問題の説明

レッスンファイルを更新した際、`lessons`テーブルの`s3_key`フィールドがファイル名だけになってしまい、フルパスが失われる問題が発生しています。

### 例:
- ❌ 不正: `C1.1Windows 11 の基本操作とソフトウェアの活用.md`
- ✅ 正常: `lessons/ITリテラシー・AIの基本/Windows 11 の基本操作とソフトウェアの活用/C1.1Windows 11 の基本操作とソフトウェアの活用.md`

## 修正手順

### オプション1: MySQLクライアントで直接修正（推奨）

1. **MySQL Workbench または HeidiSQL を起動**

2. **StudySphereデータベースに接続**
   - Host: localhost
   - Port: 3306
   - Database: curriculum-portal
   - User: root
   - Password: shinomoto926!

3. **SQLファイルを開く**
   ```
   studysphere-backend/db/fix-s3-keys-filepath.sql
   ```

4. **各ステップを順番に実行**

   **ステップ1: 問題のあるレッスンを確認**
   ```sql
   SELECT 
       l.id,
       l.title as lesson_title,
       c.title as course_title,
       l.s3_key,
       CASE 
           WHEN l.s3_key NOT LIKE 'lessons/%' THEN '不正なパス（ファイル名のみ）'
           WHEN l.s3_key LIKE 'lessons/%/%/%.%' THEN '正常'
           ELSE '要確認'
       END as status
   FROM lessons l
   LEFT JOIN courses c ON l.course_id = c.id
   WHERE l.status != 'deleted'
     AND l.s3_key NOT LIKE 'lessons/%'
     AND l.s3_key IS NOT NULL
   ORDER BY l.id;
   ```
   
   このクエリで不正なS3キーを持つレッスンが表示されます。

   **ステップ2: lessonsテーブルのS3キーを修正**
   ```sql
   UPDATE lessons l
   INNER JOIN courses c ON l.course_id = c.id
   SET l.s3_key = CONCAT('lessons/', c.title, '/', l.title, '/', l.s3_key)
   WHERE l.status != 'deleted'
     AND l.s3_key NOT LIKE 'lessons/%'
     AND l.s3_key IS NOT NULL;
   ```

   **ステップ3: lesson_text_video_linksテーブルも修正**
   ```sql
   UPDATE lesson_text_video_links ltv
   INNER JOIN lessons l ON ltv.lesson_id = l.id
   SET ltv.text_file_key = l.s3_key,
       ltv.updated_at = CURRENT_TIMESTAMP
   WHERE ltv.text_file_key != l.s3_key;
   ```

   **ステップ4: 修正結果を確認**
   ```sql
   SELECT 
       l.id,
       l.title as lesson_title,
       l.s3_key,
       CASE 
           WHEN l.s3_key LIKE 'lessons/%/%/%.%' THEN '正常 ✓'
           ELSE '要確認 ✗'
       END as status
   FROM lessons l
   WHERE l.status != 'deleted'
   ORDER BY l.id;
   ```

### オプション2: コマンドラインで修正

1. **データベースを起動**
   ```powershell
   cd studysphere-backend
   .\start-database.bat
   ```

2. **SQLファイルを実行**
   ```powershell
   mysql -h localhost -u root -pshinomoto926! curriculum-portal < db\fix-s3-keys-filepath.sql
   ```

## 注意事項

⚠️ **重要**: このSQLを実行する前に：

1. **データベースのバックアップを取得**
   ```powershell
   cd studysphere-backend
   mysqldump -h localhost -u root -pshinomoto926! curriculum-portal > backup_before_s3_fix.sql
   ```

2. **S3上のファイル構造を確認**
   - S3上のファイルが実際に `lessons/コース名/レッスン名/ファイル名` の形式で保存されているか確認
   - 必要に応じて、S3のファイルパスもリネームまたは移動

3. **テスト環境で先に試す**（可能な場合）

## 修正後の確認

1. **ブラウザでキャッシュをクリア** (Ctrl + Shift + Delete)

2. **バックエンドを再起動**
   ```powershell
   cd studysphere-backend
   # Dockerの場合
   docker-compose restart backend
   
   # または直接起動の場合
   # バックエンドプロセスを停止して再起動
   ```

3. **学習画面でレッスンを開く**
   - テキストが正しく表示されることを確認
   - 「PDFファイルが見つかりません」エラーが出ないことを確認

4. **ログを確認**
   ```powershell
   cd studysphere-backend
   .\show-logs.bat
   ```

## トラブルシューティング

### エラー: S3からファイルが見つからない

修正後もエラーが出る場合、S3上のファイルパスとデータベースのS3キーが一致していない可能性があります。

1. AWS S3コンソールで実際のファイルパスを確認
2. 必要に応じて、S3上でファイルをコピー・移動
3. またはデータベースのS3キーを実際のS3パスに合わせて修正

### 確認方法

```sql
-- 特定のレッスンのS3キーを確認
SELECT id, title, s3_key FROM lessons WHERE id = 1;

-- 手動で修正（例）
UPDATE lessons 
SET s3_key = 'lessons/ITリテラシー・AIの基本/Windows 11 の基本操作とソフトウェアの活用/C1.1Windows 11 の基本操作とソフトウェアの活用.md'
WHERE id = 1;
```

## 予防策

今後このような問題を防ぐため、`updateLesson`関数を修正しました。今後のファイル更新では自動的に正しいパスが維持されます。

