@echo off
echo コース・レッスンテーブルの作成を開始します...

docker exec -i studysphere-backend-db-1 mysql -u root -ppassword myapp < db/create-courses-lessons-tables.sql

if %ERRORLEVEL% EQU 0 (
    echo コース・レッスンテーブルの作成が完了しました。
) else (
    echo エラーが発生しました。ログを確認してください。
)

pause 