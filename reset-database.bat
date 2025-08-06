@echo off
chcp 65001 >nul
echo [WARNING] Database Complete Reset
echo [WARNING] This operation will delete ALL data!
echo.
set /p confirm="Do you really want to proceed? (y/N): "
if /i not "%confirm%"=="y" (
    echo [INFO] Reset cancelled.
    pause
    exit /b
)

echo.
echo [INFO] Stopping containers...
docker-compose down

echo [INFO] Removing volume...
docker volume rm studysphere-backend_mysql_data

echo [INFO] Removing initialization flag...
if exist ".initialized" del .initialized

echo [SUCCESS] Reset completed!
echo.
echo [INFO] Database will be newly initialized on next start-all.bat execution.
pause 