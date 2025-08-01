@echo off
echo 指導者専門分野テーブルの追加マイグレーションを実行します...
echo.

REM Dockerコンテナが起動しているかチェック
docker ps | findstr "mysql" >nul
if errorlevel 1 (
    echo MySQLコンテナが起動していません。先にdocker-compose up -dを実行してください。
    pause
    exit /b 1
)

REM マイグレーション実行
echo マイグレーションファイルを実行中...
docker exec -i studysphere-backend-mysql-1 mysql -u root -proot < db/add-instructor-specializations.sql

if errorlevel 1 (
    echo マイグレーションの実行に失敗しました。
    pause
    exit /b 1
)

echo.
echo マイグレーションが正常に完了しました。
echo 指導者専門分野テーブルが追加されました。
pause 