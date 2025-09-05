@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo StudySphere Development Environment
echo ========================================
echo [INFO] Stopping all services...
echo.

REM Stop Node.js processes (backend and frontend)
echo [INFO] Stopping Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
if errorlevel 1 (
    echo [INFO] No Node.js processes found.
) else (
    echo [OK] Node.js processes stopped.
)
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Docker is not running. Nothing to stop.
    pause
    exit /b 0
)

REM Detect compose command (plugin vs legacy)
set USE_COMPOSE_PLUGIN=
docker compose version >nul 2>&1 && set USE_COMPOSE_PLUGIN=1

REM Check if services are running
if defined USE_COMPOSE_PLUGIN (
    docker compose ps | findstr "Up" >nul 2>&1
) else (
    docker-compose ps | findstr "Up" >nul 2>&1
)
if errorlevel 1 (
    echo [INFO] No services are currently running.
    pause
    exit /b 0
)

REM Stop services gracefully
echo [INFO] Stopping services gracefully...
if defined USE_COMPOSE_PLUGIN (
    docker compose down
) else (
    docker-compose down
)

if errorlevel 1 (
    echo [WARNING] Some services may not have stopped cleanly.
    echo [INFO] You can force stop with: docker compose down --remove-orphans
    echo [INFO] Or: docker-compose down --remove-orphans
) else (
    echo [OK] All services stopped successfully.
)

echo.
echo [INFO] StudySphere Environment stopped.
echo [INFO] You can restart with: start-all.bat
pause
