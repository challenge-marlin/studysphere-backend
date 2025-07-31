@echo off
echo ========================================
echo StudySphere Backend Development
echo ========================================
echo.
echo Starting MySQL Database and Backend Server...
echo.
echo Backend API: http://localhost:5000
echo MySQL Database: localhost:3307
echo.
echo Press Ctrl+C to stop all services
echo ========================================
echo.

REM Docker ComposeでバックエンドとDBを起動
docker-compose up -d

REM ログを表示
docker-compose logs -f backend 