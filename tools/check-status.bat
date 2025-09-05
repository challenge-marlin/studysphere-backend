@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo [INFO] Checking StudySphere Service Status...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running.
    pause
    exit /b 1
)

REM Show container status
echo [INFO] Container Status:
docker compose ps
echo.

REM Check if containers are running
docker compose ps | findstr "Up" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] No services are currently running.
    echo [INFO] Run 'start-all.bat' to start services.
    pause
    exit /b 0
)

REM Check MySQL
echo [INFO] Checking MySQL...
docker compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! --silent >nul 2>&1
if errorlevel 1 (
    echo [WARNING] MySQL is not ready yet.
) else (
    echo [SUCCESS] MySQL is ready ✓
)

REM Check Backend
echo [INFO] Checking Backend...
curl -s -m 5 -o nul -w "%%{http_code}" http://localhost:5000/health > temp_code.txt 2>nul
set /p CODE=<temp_code.txt
del temp_code.txt

if "%CODE%"=="200" (
    echo [SUCCESS] Backend is ready ✓
) else (
    echo [WARNING] Backend is not ready yet (HTTP: %CODE%)
)

echo.
echo [INFO] Service URLs:
echo [INFO] Backend → http://localhost:5000
echo [INFO] Health Check → http://localhost:5000/health
echo.
echo [INFO] Admin Login → ID: admin001 / パスワード: admin123
echo.

REM Show recent logs
echo [INFO] Recent logs (last 10 lines):
docker compose logs --tail=10

echo.
echo [INFO] Status check completed.
pause
