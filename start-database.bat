@echo off

REM Relaunch self in persistent console window when not marked as :run (handles double-click)
if /I not "%~1"==":run" (
    start "StudySphere Database" "%ComSpec%" /k "%~f0" :run
    exit /b
)
shift

chcp 65001 >nul
setlocal enabledelayedexpansion

REM Ensure working directory is this script's directory
cd /d "%~dp0"

echo ========================================
echo StudySphere Database Startup
echo ========================================
echo [INFO] Starting MySQL database...
echo.

REM Check Docker
echo [INFO] Checking Docker availability...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)
echo [OK] Docker is running.

REM Detect compose command (plugin vs legacy)
echo [INFO] Detecting Docker Compose command...
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
echo [OK] Docker Compose available.

REM Ensure docker-compose.yml exists in this directory
if not exist "docker-compose.yml" (
    echo [ERROR] docker-compose.yml not found in: %cd%
    echo [HINT] Please run this script from 'studysphere-backend' directory.
    pause
    exit /b 1
)

REM Stop any existing database services first
echo [INFO] Stopping any existing database services...
if defined USE_COMPOSE_PLUGIN (
    docker compose stop db >nul 2>&1
    docker compose rm -f db >nul 2>&1
) else (
    docker-compose stop db >nul 2>&1
    docker-compose rm -f db >nul 2>&1
)

REM Start database service only
echo [INFO] Starting MySQL database...
if defined USE_COMPOSE_PLUGIN (
    docker compose up -d db
    set COMPOSE_EXIT_CODE=!errorlevel!
) else (
    docker-compose up -d db
    set COMPOSE_EXIT_CODE=!errorlevel!
)

if !COMPOSE_EXIT_CODE! neq 0 (
    echo [ERROR] Failed to start database service. Exit code: !COMPOSE_EXIT_CODE!
    pause
    exit /b 1
)

echo [OK] Database service started successfully!
echo.

REM Wait for database to be ready
echo [INFO] Waiting for database to be ready...
timeout /t 20 /nobreak >nul

REM Check database connection
echo [INFO] Checking database connection...
if defined USE_COMPOSE_PLUGIN (
    docker compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! >nul 2>&1
    set DB_CHECK_RESULT=!errorlevel!
) else (
    docker-compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! >nul 2>&1
    set DB_CHECK_RESULT=!errorlevel!
)

if !DB_CHECK_RESULT! neq 0 (
    echo [WARN] Database not ready, waiting additional 15 seconds...
    timeout /t 15 /nobreak >nul
    if defined USE_COMPOSE_PLUGIN (
        docker compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! >nul 2>&1
        set DB_CHECK_RESULT=!errorlevel!
    ) else (
        docker-compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! >nul 2>&1
        set DB_CHECK_RESULT=!errorlevel!
    )
    if !DB_CHECK_RESULT! neq 0 (
        echo [ERROR] Database connection failed after retry
        pause
        exit /b 1
    )
)

echo [OK] Database is ready!
echo.

echo ========================================
echo [SUCCESS] StudySphere Database is Ready!
echo ========================================
echo.
echo Database:
echo   MySQL Database:  localhost:3307
echo   Username:        root
echo   Password:        shinomoto926!
echo   Database:        curriculum-portal
echo.
echo Useful Commands:
echo   View logs:       docker compose logs -f db
echo   Check status:    docker compose ps
echo   Stop database:   docker compose stop db
echo.

REM Show current status
echo [INFO] Current database status:
if defined USE_COMPOSE_PLUGIN (
    docker compose ps db
) else (
    docker-compose ps db
)

echo.
echo [INFO] Database is running in the background.
echo [INFO] Use 'docker compose stop db' to stop the database when done.
echo.

pause
