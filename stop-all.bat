@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo [INFO] Stopping StudySphere Development Environment...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Docker is not running. Nothing to stop.
    pause
    exit /b 0
)

REM Check if services are running
docker compose ps | findstr "Up" >nul 2>&1
if errorlevel 1 (
    echo [INFO] No services are currently running.
    pause
    exit /b 0
)

REM Stop services gracefully
echo [INFO] Stopping services gracefully...
docker compose down

if errorlevel 1 (
    echo [WARNING] Some services may not have stopped cleanly.
    echo [INFO] You can force stop with: docker compose down --remove-orphans
) else (
    echo [INFO] All services stopped successfully ✓
)

echo.
echo [INFO] StudySphere Environment stopped.
pause
