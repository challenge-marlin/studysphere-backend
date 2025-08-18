@echo off
echo データベースマイグレーションを実行中...
echo.

REM Dockerコンテナが起動しているかチェック
docker ps | findstr "mysql" >nul
if errorlevel 1 (
    echo MySQLコンテナが起動していません。先にstart-all.batを実行してください。
    pause
    exit /b 1
)

echo MySQLコンテナに接続してマイグレーションを実行します...
docker exec -i studysphere-backend-mysql-1 mysql -uroot -pshinomoto926! curriculum-portal < db/add_instructor_id_migration.sql

if errorlevel 1 (
    echo マイグレーションの実行に失敗しました。
    pause
    exit /b 1
) else (
    echo マイグレーションが正常に完了しました。
    echo instructor_idカラムがuser_accountsテーブルに追加されました。
)

pause
