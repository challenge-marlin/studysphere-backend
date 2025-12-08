# ログファイルの場所

## 開発環境のログ出力先

開発環境では、ログファイルは以下の場所に保存されます：

```
studysphere-backend/backend/logs/{年}/{月}/{日}/
```

### 具体例
- 2025年1月15日のログ: `studysphere-backend/backend/logs/2025/01/15/`
- 2025年12月31日のログ: `studysphere-backend/backend/logs/2025/12/31/`

## ログファイルの種類

各日付ディレクトリには以下のログファイルが保存されます：

1. **combined.log** - すべてのログレベル（error、warn、info、debug）
2. **error.log** - エラーログのみ
3. **debug.log** - デバッグログ（開発環境のみ）
4. **exceptions.log** - 例外エラーログ
5. **rejections.log** - プロミス拒否エラーログ

## ログの確認方法

### Windows環境での確認方法

1. **PowerShellまたはコマンドプロンプトで確認**
   ```powershell
   cd studysphere-backend\backend\logs
   # 今日の日付ディレクトリに移動
   cd 2025\01\15  # 例: 2025年1月15日
   # ログファイルを表示
   type combined.log
   # または
   Get-Content combined.log -Tail 100
   ```

2. **ファイルエクスプローラーで確認**
   - `studysphere-backend\backend\logs` フォルダを開く
   - 年 → 月 → 日の順にフォルダを開く
   - `combined.log` または `debug.log` をメモ帳やテキストエディタで開く

### 最新のログを確認する場合

最新のログを確認するには、以下のコマンドを使用します：

```powershell
# 最新のログディレクトリを探す
$latestLogDir = Get-ChildItem -Path "studysphere-backend\backend\logs" -Recurse -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1

# 最新のcombined.logを表示（最後の100行）
Get-Content "$latestLogDir\combined.log" -Tail 100

# デバッグログを表示（最後の100行）
Get-Content "$latestLogDir\debug.log" -Tail 100 -ErrorAction SilentlyContinue
```

## 承認状態のデバッグログを確認する場合

承認状態が維持されているか確認するには、以下のログメッセージを検索してください：

- `🛡️ 承認済みレッスンの再受験`
- `🛡️ 承認済みレッスンの更新パラメータ`
- `🛡️ 承認済みレッスンの承認状態を維持しました`
- `🔍 更新後の承認状態確認`

これらのログは `combined.log` または `debug.log` に出力されます。

## コンソール出力

開発環境では、ログはコンソール（ターミナル）にも出力されます。
サーバーを起動しているターミナルウィンドウで、上記のログメッセージを確認できます。

