# レッスン動画機能（複数動画対応）

## 概要

レッスンセクションの動画機能を拡張し、1つのレッスンに複数の動画を紐づけられるようになりました。

## 主な変更点

### 1. データベース構造の変更

#### 新しいテーブル: `lesson_videos`
```sql
CREATE TABLE lesson_videos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lesson_id INT NOT NULL COMMENT '関連レッスンID',
    title VARCHAR(255) NOT NULL COMMENT '動画タイトル',
    description TEXT COMMENT '動画説明',
    youtube_url VARCHAR(500) NOT NULL COMMENT 'YouTube動画URL',
    order_index INT NOT NULL DEFAULT 0 COMMENT '表示順序',
    duration VARCHAR(50) COMMENT '動画の長さ',
    thumbnail_url VARCHAR(500) COMMENT 'サムネイル画像URL',
    status ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT COMMENT '作成者ID',
    updated_by INT COMMENT '更新者ID',
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);
```

#### 既存テーブルの変更: `lessons`
- `youtube_url`フィールドは後方互換性のため残存
- 新しい動画は`lesson_videos`テーブルで管理

### 2. 新しいAPIエンドポイント

#### レッスン動画管理API
```
GET    /api/lesson-videos/lesson/:lessonId    # レッスンの動画一覧取得
GET    /api/lesson-videos/:id                  # 動画詳細取得
POST   /api/lesson-videos/lesson/:lessonId    # 動画作成
PUT    /api/lesson-videos/:id                  # 動画更新
DELETE /api/lesson-videos/:id                  # 動画削除
PUT    /api/lesson-videos/order                # 動画順序更新
```

#### レッスン詳細APIの拡張
```
GET /api/lessons/:id
```
- レスポンスに`videos`配列が追加され、関連する動画一覧を取得

### 3. フロントエンドの変更

#### 新しいコンポーネント: `MultiVideoPlayer`
- 複数の動画を表示・管理
- 動画一覧表示
- 動画選択機能
- 管理者向け編集機能

#### 既存ページの更新: `LearningPage`
- `LessonVideoPlayer`から`MultiVideoPlayer`に変更
- 複数動画に対応したデータ構造

## 使用方法

### 1. データベースのセットアップ

```bash
# データベースの初期化（新しいテーブル作成）
mysql -u root -p < db/init.sql

# 既存データの移行
mysql -u root -p < db/migrate_lesson_videos.sql
```

### 2. バックエンドの起動

```bash
cd studysphere-backend
npm install
npm start
```

### 3. フロントエンドの起動

```bash
cd studysphere-frontend
npm install
npm start
```

### 4. 動画管理

#### 管理者として動画を追加
1. レッスン詳細ページにアクセス
2. 「動画を編集」ボタンをクリック
3. 「動画追加」ボタンで新しい動画を追加
4. 動画情報を入力（タイトル、説明、YouTube URL等）
5. 「保存」ボタンで変更を確定

#### 動画の順序変更
1. 編集モードで動画一覧を表示
2. 動画をドラッグ&ドロップまたは順序を指定
3. 変更を保存

## API仕様

### 動画作成
```javascript
POST /api/lesson-videos/lesson/:lessonId
Content-Type: application/json

{
  "title": "動画タイトル",
  "description": "動画の説明",
  "youtube_url": "https://www.youtube.com/watch?v=...",
  "order_index": 0,
  "duration": "15分30秒",
  "thumbnail_url": "https://..."
}
```

### 動画更新
```javascript
PUT /api/lesson-videos/:id
Content-Type: application/json

{
  "title": "更新されたタイトル",
  "description": "更新された説明",
  "youtube_url": "https://www.youtube.com/watch?v=...",
  "order_index": 1,
  "duration": "20分15秒"
}
```

### 動画順序更新
```javascript
PUT /api/lesson-videos/order
Content-Type: application/json

{
  "videos": [
    {"id": 1, "order_index": 0},
    {"id": 2, "order_index": 1},
    {"id": 3, "order_index": 2}
  ]
}
```

## 後方互換性

- 既存の`lessons.youtube_url`フィールドは維持
- 既存のAPIエンドポイントは変更なし
- フロントエンドは段階的に移行可能

## トラブルシューティング

### よくある問題

1. **動画が表示されない**
   - データベースの移行が完了しているか確認
   - APIレスポンスに`videos`配列が含まれているか確認

2. **動画の順序が正しくない**
   - `order_index`の値が正しく設定されているか確認
   - データベースで直接確認

3. **YouTube動画が再生されない**
   - YouTube URLが正しい形式か確認
   - 動画が公開されているか確認

### ログの確認

```bash
# バックエンドログ
tail -f studysphere-backend/backend/logs/app.log

# エラーログ
tail -f studysphere-backend/backend/logs/error.log
```

## 今後の拡張予定

- 動画の視聴進捗管理
- 動画の評価・コメント機能
- 動画のダウンロード機能
- 動画の品質設定（HD/SD）
- 動画の字幕機能
