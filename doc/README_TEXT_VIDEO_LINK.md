# テキストと動画の紐づけ機能

## 概要

レッスン管理セクションにテキスト（PDFファイル）と動画の1対1の紐づけ機能を追加しました。これにより、特定のテキストファイルと動画を関連付けて、学習コンテンツの連携を管理できます。

## 機能

### 1. テキストと動画の紐づけ管理
- レッスン内のPDFファイルと動画を1対1で紐づけ
- 紐づけの順序管理
- 紐づけの作成、編集、削除

### 2. データベース構造

#### lesson_text_video_links テーブル
```sql
CREATE TABLE lesson_text_video_links (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '紐づけID',
    lesson_id INT NOT NULL COMMENT '関連レッスンID',
    text_file_key VARCHAR(1024) NOT NULL COMMENT 'テキストファイルのS3キー',
    video_id INT NOT NULL COMMENT '関連動画ID',
    link_order INT NOT NULL DEFAULT 0 COMMENT '紐づけ順序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    created_by INT COMMENT '作成者ID',
    updated_by INT COMMENT '更新者ID',
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES lesson_videos(id) ON DELETE CASCADE,
    UNIQUE KEY unique_text_video_link (lesson_id, text_file_key, video_id),
    INDEX idx_lesson_id (lesson_id),
    INDEX idx_video_id (video_id),
    INDEX idx_link_order (link_order)
);
```

### 3. API エンドポイント

#### テキストと動画の紐づけ取得
- `GET /api/lesson-text-video-links/lesson/:lessonId` - レッスンの紐づけ一覧取得
- `GET /api/lesson-text-video-links/:id` - 特定の紐づけ取得

#### テキストと動画の紐づけ管理（管理者のみ）
- `POST /api/lesson-text-video-links` - 新しい紐づけ作成
- `PUT /api/lesson-text-video-links/:id` - 紐づけ更新
- `DELETE /api/lesson-text-video-links/:id` - 紐づけ削除
- `PUT /api/lesson-text-video-links/order` - 紐づけ順序更新
- `POST /api/lesson-text-video-links/bulk-upsert` - 複数紐づけの一括作成・更新

### 4. フロントエンド機能

#### レッスン管理画面
- レッスン一覧に「🔗 テキスト・動画紐づけ」ボタンを追加
- 紐づけ管理モーダルで紐づけの作成、編集、削除が可能
- 利用可能なテキストファイル（PDF）と動画の選択
- 紐づけ順序の管理

#### UI コンポーネント
- `LessonManagement.js` に紐づけ機能を統合
- モーダル形式での直感的な操作
- リアルタイムでの紐づけ状態表示

## 使用方法

### 1. データベースの更新
```bash
# MySQLに接続してテーブルを作成
mysql -u root -p < scripts/update-database.sql
```

### 2. バックエンドの起動
```bash
# バックエンドサーバーを起動
npm start
```

### 3. フロントエンドの起動
```bash
# フロントエンドサーバーを起動
npm start
```

### 4. 紐づけの作成手順
1. レッスン管理画面にアクセス
2. 対象レッスンの「🔗 テキスト・動画紐づけ」ボタンをクリック
3. 「新しい紐づけを追加」ボタンをクリック
4. テキストファイル（PDF）と動画を選択
5. 表示順序を設定
6. 「作成」ボタンをクリック

## 制約事項

- テキストファイルはPDF形式のみ対応
- 1つのテキストファイルに対して1つの動画のみ紐づけ可能
- 同じレッスン内で同じテキストファイルと動画の組み合わせは重複不可
- 管理者権限が必要

## 今後の拡張予定

- 複数の動画との紐づけ対応
- 他のファイル形式（DOCX、PPTX等）の対応
- 紐づけの一括インポート機能
- 学習進捗との連携機能

## トラブルシューティング

### よくある問題

1. **テーブルが作成されない**
   - MySQLの権限を確認
   - データベース名が正しいか確認

2. **APIエラーが発生する**
   - バックエンドサーバーが起動しているか確認
   - 認証トークンが有効か確認

3. **フロントエンドでボタンが表示されない**
   - ブラウザのキャッシュをクリア
   - 管理者権限でログインしているか確認
