@echo off
chcp 65001 > nul
echo ===========================================
echo lesson_text_video_links修正スクリプト実行
echo ===========================================
echo.
echo このスクリプトは、レッスンファイル更新時に
echo lesson_text_video_linksテーブルに残った古いS3キーを修正します。
echo.
pause

cd /d "%~dp0"
node tools\fix-lesson-text-video-links.js

echo.
echo ===========================================
echo 処理が完了しました。
echo ===========================================
pause

