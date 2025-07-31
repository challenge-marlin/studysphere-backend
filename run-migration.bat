@echo off
echo データベースマイグレーションを実行します...
echo.

REM MySQLに接続してマイグレーションを実行
mysql -u root -p < db/add-phone-to-satellites.sql

echo.
echo マイグレーションが完了しました。
pause 