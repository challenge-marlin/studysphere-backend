@echo off
echo 一時パスワード機能用テーブルのマイグレーションを開始します...
echo.

cd /d "%~dp0"

echo Node.jsでマイグレーションスクリプトを実行中...
node scripts/migrate-temp-password-tables.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo マイグレーションが正常に完了しました！
    echo 一時パスワード機能が利用可能になりました。
) else (
    echo.
    echo マイグレーションが失敗しました。
    echo エラーログを確認してください。
)

echo.
pause
