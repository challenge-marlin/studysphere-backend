@echo off
echo 学習機能の初期データ作成を開始します...

cd backend

echo Node.jsスクリプトを実行中...
node tools/init-learning-data.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo 学習機能の初期データ作成が完了しました！
    echo.
    pause
) else (
    echo.
    echo エラーが発生しました。ログを確認してください。
    echo.
    pause
)
