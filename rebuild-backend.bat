@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==========================================
echo  StudySphere Backend 強制リビルド（データ保持）
echo ==========================================
echo.

REM Docker 起動確認
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop を起動してください。
    pause
    exit /b 1
)

REM カレントに docker-compose.yml があることを確認
if not exist "docker-compose.yml" (
    echo [ERROR] このバッチは studysphere-backend フォルダ内で実行してください。
    pause
    exit /b 1
)

REM .env のBOM除去（存在する場合のみ）
if exist ".env" (
    echo [INFO] .env の BOM を除去します...
    powershell -NoProfile -Command ^
      "$p = Resolve-Path .\.env; $c = Get-Content -Raw -Path $p; $enc = New-Object System.Text.UTF8Encoding($false); [System.IO.File]::WriteAllText($p, $c, $enc)"
)

echo [INFO] Backend コンテナを停止しています...
docker compose stop backend >nul 2>&1

echo [INFO] Backend コンテナを削除しています（データは削除しません）...
docker compose rm -f backend >nul 2>&1

echo [INFO] Backend イメージを --no-cache で強制ビルドしています...
docker compose build backend --no-cache
if errorlevel 1 (
    echo [ERROR] Backend のビルドに失敗しました。
    pause
    exit /b 1
)

echo [INFO] DB と Backend を再起動しています...
docker compose up -d db backend
if errorlevel 1 (
    echo [ERROR] コンテナの起動に失敗しました。
    pause
    exit /b 1
)

echo [INFO] Backend のヘルスチェックを実施します...
timeout /t 5 /nobreak >nul
curl -f http://localhost:5000/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] ヘルスチェックに失敗しました。ログを表示します。
    echo.
    docker compose logs --no-color --tail 200 backend
    echo.
    echo [HINT] 追跡表示: docker compose logs -f backend
    pause
    exit /b 1
)

echo.
echo [SUCCESS] 強制リビルドと再起動が完了しました（データ保持）。
echo [INFO] Backend: http://localhost:5000
echo [INFO] ログの追跡表示: docker compose logs -f backend
echo.
pause


