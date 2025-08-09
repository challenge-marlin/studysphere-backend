@echo off

REM Relaunch self in persistent console window when not marked as :run (handles double-click)
if /I not "%~1"==":run" (
    start "StudySphere Backend" "%ComSpec%" /k "%~f0" :run
    exit /b
)
shift

chcp 65001 >nul
setlocal enabledelayedexpansion

REM Ensure working directory is this script's directory
cd /d "%~dp0"

echo [INFO] Starting StudySphere Development Environment...
echo [INFO] This is a simplified and safer startup process
echo [INFO] Run without args to show interactive menu.
echo [INFO] Or specify directly: start-all.bat [recreate^|rebuild]
echo [INFO]   recreate: Force recreate containers (no rebuild)
echo [INFO]   rebuild : Rebuild images then recreate
echo.

REM Parse mode argument
set MODE=%1
if "%MODE%"=="" set MODE=default

REM Interactive menu when no explicit arg is provided
if /I "%1"=="" goto menu
goto after_menu

:menu
echo [INFO] Select mode:
echo   1) Normal (hot reload, no recreate)
echo   2) Recreate (--force-recreate)
echo   3) Rebuild + Recreate (build -^> up --force-recreate)
set /p CHOICE=Enter a number [1-3] ^> 
if "%CHOICE%"=="1" set MODE=default& goto after_menu
if "%CHOICE%"=="2" set MODE=recreate& goto after_menu
if "%CHOICE%"=="3" set MODE=rebuild& goto after_menu
echo [WARN] Invalid choice. Please choose 1-3.
echo.
goto menu
:after_menu
echo [INFO] Selected mode: %MODE%

REM Check Docker
echo [INFO] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Detect compose command (plugin vs legacy)
set USE_COMPOSE_PLUGIN=
docker compose version >nul 2>&1 && set USE_COMPOSE_PLUGIN=1
if not defined USE_COMPOSE_PLUGIN (
    docker-compose version >nul 2>&1 || (
        echo [ERROR] Neither 'docker compose' nor 'docker-compose' is available in PATH.
        echo [HINT] Install Docker Desktop or ensure PATH includes Docker binaries.
        pause
        exit /b 1
    )
)

REM Ensure docker-compose.yml exists in this directory
if not exist "docker-compose.yml" (
    echo [ERROR] docker-compose.yml not found in: %cd%
    echo [HINT] Please run this script from 'studysphere-backend' directory.
    pause
    exit /b 1
)

REM Stop any existing services first
echo [INFO] Stopping any existing services...
if defined USE_COMPOSE_PLUGIN (
    docker compose down >nul 2>&1
) else (
    docker-compose down >nul 2>&1
)

REM Build images when requested
if /I "%MODE%"=="rebuild" (
    echo [INFO] Building images...
    if defined USE_COMPOSE_PLUGIN (
        docker compose build
    ) else (
        docker-compose build
    )
    if errorlevel 1 (
        echo [ERROR] Failed to build images.
        pause
        exit /b 1
    )
)

REM Start services according to mode (avoid nested IF/ELSE for robustness)
if /I "%MODE%"=="recreate" goto do_up_recreate
if /I "%MODE%"=="rebuild" goto do_up_recreate
goto do_up_default

:do_up_recreate
echo [INFO] Starting services with force recreate...
if defined USE_COMPOSE_PLUGIN (
    docker compose up -d --force-recreate
) else (
    docker-compose up -d --force-recreate
)
goto after_up

:do_up_default
echo [INFO] Starting services (no wait mode)...
if defined USE_COMPOSE_PLUGIN (
    docker compose up -d
) else (
    docker-compose up -d
)

:after_up

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
echo [INFO] Admin Login -> ID: admin001 / password: admin123
echo [INFO] Backend -> http://localhost:5000
echo [INFO] Health Check -> http://localhost:5000/health
echo.

REM Show current status
echo [INFO] Current service status:
docker compose ps

echo.
echo [INFO] Startup completed. Services are running in background.
echo [INFO] Use 'stop-all.bat' to stop services when done.
pause
