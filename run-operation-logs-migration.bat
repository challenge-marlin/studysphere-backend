@echo off
echo 操作ログテーブルの作成を開始します...

REM Dockerコンテナ内でSQLファイルを実行
docker-compose exec db mysql -u root -pshinomoto926! curriculum-portal < db/create-operation-logs-table.sql

if %ERRORLEVEL% EQU 0 (
    echo 操作ログテーブルの作成が完了しました。
) else (
    echo 操作ログテーブルの作成に失敗しました。
    pause
) 