@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo StudySphere Backend Development
echo ========================================
echo.
echo [INFO] This script is deprecated and will be removed in future versions.
echo [INFO] Please use 'start-all.bat' instead for better functionality.
echo.
echo [INFO] Redirecting to start-all.bat...
echo.

REM Call start-all.bat with default mode
call "%~dp0start-all.bat" default

REM If start-all.bat fails, show helpful message
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start services via start-all.bat
    echo [HINT] Please check the error messages above and try again.
    echo [HINT] You can also run 'start-all.bat' directly for more options.
    pause
    exit /b 1
)

echo.
echo [INFO] Backend started successfully via start-all.bat
echo [INFO] You can now use the main start-all.bat script for future startups.
pause 