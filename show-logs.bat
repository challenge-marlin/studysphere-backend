@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo [INFO] Showing StudySphere Service Logs...
echo [INFO] Press Ctrl+C to stop viewing logs
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running.
    pause
    exit /b 1
)

REM Check if services are running
docker compose ps | findstr "Up" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] No services are currently running.
    echo [INFO] Run 'start-all.bat' to start services.
    pause
    exit /b 0
)

REM Show logs
echo [INFO] Showing logs for all services...
docker compose logs -f
