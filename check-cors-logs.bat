@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo CORS設定ログ確認
echo ========================================
echo.
echo [INFO] バックエンドコンテナのログを確認します...
echo [INFO] CORS設定デバッグ情報を検索します...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running.
    echo [HINT] Docker Desktopを起動してください。
    pause
    exit /b 1
)

REM Check if backend container is running
docker ps | findstr "express_app" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] バックエンドコンテナ（express_app）が実行されていません。
    echo [INFO] 'start-all.bat'を実行してサービスを起動してください。
    pause
    exit /b 0
)

echo [INFO] バックエンドコンテナのログを表示します...
echo [INFO] Ctrl+Cで終了します
echo.
echo ========================================
echo 最新のCORS設定ログ（最後の50行）:
echo ========================================
docker logs express_app --tail 50 2>&1 | findstr /i "CORS cors 設定"
echo.
echo ========================================
echo すべてのログを表示（リアルタイム）:
echo ========================================
echo [INFO] すべてのログを表示するには、このウィンドウで 'docker logs -f express_app' を実行してください
echo [INFO] または、'show-logs.bat'を実行してください
echo.
pause

