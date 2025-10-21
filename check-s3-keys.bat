@echo off
chcp 65001 > nul
echo ===========================================
echo レッスンS3キー確認スクリプト実行
echo ===========================================
echo.

cd /d "%~dp0"
node tools\check-lesson-s3-keys.js

echo.
pause

