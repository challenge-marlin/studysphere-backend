@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo [INFO] Starting StudySphere Development Environment...
echo [INFO] This is a simplified and safer startup process
echo.

REM Check Docker
echo [INFO] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Stop any existing services first
echo [INFO] Stopping any existing services...
docker compose down >nul 2>&1

REM Start services without waiting
echo [INFO] Starting services (no wait mode)...
docker compose up -d

if errorlevel 1 (
    echo [ERROR] Failed to start services.
    pause
    exit /b 1
)

echo [INFO] Services started successfully!
echo.
echo [INFO] Services are starting in the background...
echo [INFO] You can check status with: docker compose ps
echo [INFO] You can view logs with: docker compose logs -f
echo.
echo [INFO] Admin Login → ID: admin001 / パスワード: admin123
echo [INFO] Backend → http://localhost:5000
echo [INFO] Health Check → http://localhost:5000/health
echo.

REM Show current status
echo [INFO] Current service status:
docker compose ps

echo.
echo [INFO] Startup completed. Services are running in background.
echo [INFO] Use 'stop-all.bat' to stop services when done.
pause
