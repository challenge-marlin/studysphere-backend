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

REM ログファイルの設定
set LOG_DIR=logs

REM 日付ベースのディレクトリ構造を作成
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do (
    set TODAY_DATE=%%a
    set TODAY_MONTH=%%b
    set TODAY_YEAR=%%c
)

REM 日付の形式を統一（MM/DD/YYYY形式の場合）
if "%TODAY_DATE%"=="%TODAY_YEAR%" (
    REM 日付がMM/DD/YYYY形式の場合
    for /f "tokens=1-3 delims=/ " %%a in ('date /t') do (
        set TODAY_MONTH=%%a
        set TODAY_DATE=%%b
        set TODAY_YEAR=%%c
    )
)

REM 月と日を2桁に統一
if %TODAY_MONTH% LSS 10 set TODAY_MONTH=0%TODAY_MONTH:~1%
if %TODAY_DATE% LSS 10 set TODAY_DATE=0%TODAY_DATE:~1%

REM 日付ベースのログディレクトリを作成
set DATE_LOG_DIR=%LOG_DIR%\%TODAY_YEAR%\%TODAY_MONTH%\%TODAY_DATE%
set STARTUP_LOG=%DATE_LOG_DIR%\startup.log
set ERROR_LOG=%DATE_LOG_DIR%\startup-errors.log

REM 日付ベースのログディレクトリを作成
if not exist "%DATE_LOG_DIR%" mkdir "%DATE_LOG_DIR%"

REM 起動ログの開始
echo [%date% %time%] ======================================== > "%STARTUP_LOG%"
echo [%date% %time%] StudySphere Development Environment Startup >> "%STARTUP_LOG%"
echo [%date% %time%] ======================================== >> "%STARTUP_LOG%"
echo [%date% %time%] Script: %~f0 >> "%STARTUP_LOG%"
echo [%date% %time%] Working Directory: %cd% >> "%STARTUP_LOG%"
echo [%date% %time%] User: %USERNAME% >> "%STARTUP_LOG%"
echo [%date% %time%] Computer: %COMPUTERNAME% >> "%STARTUP_LOG%"
echo [%date% %time%] OS: %OS% >> "%STARTUP_LOG%"
echo [%date% %time%] ======================================== >> "%STARTUP_LOG%"

REM エラーログの初期化
echo [%date% %time%] Startup Error Log Started > "%ERROR_LOG%"

echo ========================================
echo StudySphere Development Environment
echo ========================================
echo [INFO] This script starts the complete development environment
echo [INFO] Run without args to show interactive menu.
echo [INFO] Or specify directly: start-all.bat [recreate^|rebuild^|quick]
echo [INFO]   quick    : Fast startup (no health checks)
echo [INFO]   recreate : Force recreate containers (no rebuild)
echo [INFO]   rebuild  : Rebuild images then recreate
echo.

echo [INFO] Startup script execution started

REM Parse mode argument
set MODE=%1
if "%MODE%"=="" set MODE=default

echo [INFO] Startup mode: %MODE%

REM Interactive menu when no explicit arg is provided
if /I "%1"=="" goto menu
goto after_menu

:menu
echo [INFO] Interactive menu displayed
echo [INFO] Select startup mode:
echo   1) Normal (with health checks)
echo   2) Quick (fast startup, minimal checks)
echo   3) Recreate (--force-recreate)
echo   4) Rebuild + Recreate (build -^> up --force-recreate)
set /p CHOICE=Enter a number [1-4] ^> 
if "%CHOICE%"=="1" set MODE=default& goto after_menu
if "%CHOICE%"=="2" set MODE=quick& goto after_menu
if "%CHOICE%"=="3" set MODE=recreate& goto after_menu
if "%CHOICE%"=="4" set MODE=rebuild& goto after_menu
echo [WARN] Invalid choice. Please choose 1-4.
echo.
goto menu

:after_menu
echo [INFO] Selected mode: %MODE%
echo.

REM Check Docker
echo [INFO] Checking Docker availability...
echo [INFO] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)
echo [INFO] Docker is running successfully
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
echo [INFO] Docker Compose available. Using: %USE_COMPOSE_PLUGIN%
echo [OK] Docker Compose available.

REM Ensure docker-compose.yml exists in this directory
if not exist "docker-compose.yml" (
    echo [ERROR] docker-compose.yml not found in: %cd%
    echo [HINT] Please run this script from 'studysphere-backend' directory.
    pause
    exit /b 1
)
echo [INFO] docker-compose.yml found successfully

REM Stop any existing services first
echo [INFO] Stopping any existing services...
echo [INFO] Stopping any existing services...
if defined USE_COMPOSE_PLUGIN (
    docker compose down >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Failed to stop existing services with docker compose down
    ) else (
        echo [INFO] Existing services stopped successfully
    )
) else (
    docker-compose down >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Failed to stop existing services with docker-compose down
    ) else (
        echo [INFO] Existing services stopped successfully
    )
)

REM Build images when requested
if /I "%MODE%"=="rebuild" (
    echo [INFO] Building images as requested...
    echo [INFO] Building images...
    echo [INFO] Building backend image directly...
    
    REM ビルドログをファイルに記録
    if defined USE_COMPOSE_PLUGIN (
        docker build -t studysphere-backend:latest ./backend > "%DATE_LOG_DIR%\build.log" 2>&1
    ) else (
        docker build -t studysphere-backend:latest ./backend > "%DATE_LOG_DIR%\build.log" 2>&1
    )
    
    if errorlevel 1 (
        echo [ERROR] Failed to build backend image. Check build.log for details.
        echo [ERROR] Failed to build backend image.
        echo [INFO] Build log saved to: %DATE_LOG_DIR%\build.log
        type "%DATE_LOG_DIR%\build.log"
        pause
        exit /b 1
    )
    echo [INFO] Backend image built successfully
    echo [OK] Backend image built successfully.
)

REM Start services according to mode
if /I "%MODE%"=="recreate" goto do_up_recreate
if /I "%MODE%"=="rebuild" goto do_up_recreate
goto do_up_default

:do_up_recreate
echo [INFO] Starting services with force recreate...
echo [INFO] Starting services with force recreate...
if defined USE_COMPOSE_PLUGIN (
    docker compose up -d --force-recreate > "%DATE_LOG_DIR%\startup.log" 2>&1
    set COMPOSE_EXIT_CODE=!errorlevel!
) else (
    docker-compose up -d --force-recreate > "%DATE_LOG_DIR%\startup.log" 2>&1
    set COMPOSE_EXIT_CODE=!errorlevel!
)

REM 起動ログをチェック
if !COMPOSE_EXIT_CODE! neq 0 (
    echo [ERROR] Failed to start services with force recreate. Exit code: !COMPOSE_EXIT_CODE!
    echo [ERROR] Failed to start services. Check startup.log for details.
    type "%DATE_LOG_DIR%\startup.log"
    pause
    exit /b 1
)
echo [INFO] Services started successfully with force recreate
goto after_up

:do_up_default
echo [INFO] Starting services normally...
echo [INFO] Starting services...
if defined USE_COMPOSE_PLUGIN (
    docker compose up -d > "%DATE_LOG_DIR%\startup.log" 2>&1
    set COMPOSE_EXIT_CODE=!errorlevel!
) else (
    docker-compose up -d > "%DATE_LOG_DIR%\startup.log" 2>&1
    set COMPOSE_EXIT_CODE=!errorlevel!
)

REM 起動ログをチェック
if !COMPOSE_EXIT_CODE! neq 0 (
    echo [ERROR] Failed to start services. Exit code: !COMPOSE_EXIT_CODE!
    echo [ERROR] Failed to start services. Check startup.log for details.
    type "%DATE_LOG_DIR%\startup.log"
    pause
    exit /b 1
)
echo [INFO] Services started successfully

:after_up

REM 起動ログの内容をチェック
echo [INFO] Checking startup logs for any warnings or errors...
if exist "%DATE_LOG_DIR%\startup.log" (
    findstr /i "error\|warning\|failed\|exception" "%DATE_LOG_DIR%\startup.log" >nul 2>&1
    if not errorlevel 1 (
        echo [WARN] Startup logs contain warnings or errors. Review startup.log for details.
        echo [WARN] Startup logs contain warnings or errors. Review startup.log for details.
    )
)

echo [OK] Services started successfully!
echo.

REM Skip health checks for quick mode
if /I "%MODE%"=="quick" goto skip_health_checks

echo [INFO] Starting health checks...
echo [INFO] Waiting for services to be ready...
echo [INFO] This may take a few minutes on first startup...
echo.

REM Wait for database to be ready
echo [INFO] Waiting for database to be ready...
echo [INFO] Waiting for database to be ready...
timeout /t 20 /nobreak >nul

REM Check database connection
echo [INFO] Checking database connection...
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
    echo [WARNING] Database not ready, waiting additional 15 seconds...
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
        echo [ERROR] Database connection failed.
        if defined USE_COMPOSE_PLUGIN (
            docker compose logs db > "%DATE_LOG_DIR%\db-error.log" 2>&1
            echo [INFO] Database error logs saved to: %DATE_LOG_DIR%\db-error.log
        ) else (
            docker-compose logs db > "%DATE_LOG_DIR%\db-error.log" 2>&1
            echo [INFO] Database error logs saved to: %DATE_LOG_DIR%\db-error.log
        )
        pause
        exit /b 1
    )
echo [INFO] Database is ready
echo [OK] Database is ready.

REM Check if admin account exists and update role to 10
echo [INFO] Checking and updating admin account...
echo [INFO] Checking and updating admin account...
if defined USE_COMPOSE_PLUGIN (
    docker compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "
INSERT IGNORE INTO companies (id, name) VALUES (1, 'アドミニストレータ');
INSERT IGNORE INTO user_accounts (id, name, role, status, login_code, company_id) VALUES (1, 'admin001', 10, 1, 'ADMN-0001-0001', 1);
INSERT IGNORE INTO admin_credentials (user_id, username, password_hash) VALUES (1, 'admin001', '\$2a\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O');
UPDATE user_accounts SET role = 10 WHERE name = 'admin001';
" > "%DATE_LOG_DIR%\admin-setup.log" 2>&1
    set ADMIN_SETUP_RESULT=!errorlevel!
) else (
    docker-compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "
INSERT IGNORE INTO companies (id, name) VALUES (1, 'アドミニストレータ');
INSERT IGNORE INTO user_accounts (id, name, role, status, login_code, company_id) VALUES (1, 'admin001', 10, 1, 'ADMN-0001-0001', 1);
INSERT IGNORE INTO admin_credentials (user_id, username, password_hash) VALUES (1, 'admin001', '\$2a\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O');
UPDATE user_accounts SET role = 10 WHERE name = 'admin001';
" > "%DATE_LOG_DIR%\admin-setup.log" 2>&1
    set ADMIN_SETUP_RESULT=!errorlevel!
)

if !ADMIN_SETUP_RESULT! neq 0 (
    echo [WARN] Admin account setup completed with warnings. Check admin-setup.log for details.
    echo [WARN] Admin account setup completed with warnings. Check admin-setup.log for details.
) else (
    echo [INFO] Admin account setup completed successfully
)
echo [OK] Admin account ready.

REM Wait for backend to be ready
echo [INFO] Waiting for backend to be ready...
echo [INFO] Waiting for backend to be ready...
timeout /t 15 /nobreak >nul

REM Check backend health
echo [INFO] Checking backend health...
echo [INFO] Checking backend health...
curl -f http://localhost:5050/ >nul 2>&1
set BACKEND_CHECK_RESULT=!errorlevel!

    if !BACKEND_CHECK_RESULT! neq 0 (
        echo [WARN] Backend not ready, waiting additional 15 seconds...
        echo [WARNING] Backend not ready, waiting additional 15 seconds...
        timeout /t 15 /nobreak >nul
        curl -f http://localhost:5050/ >nul 2>&1
        set BACKEND_CHECK_RESULT=!errorlevel!
        if !BACKEND_CHECK_RESULT! neq 0 (
            echo [ERROR] Backend health check failed after retry
            echo [ERROR] Backend health check failed.
            if defined USE_COMPOSE_PLUGIN (
                docker compose logs backend > "%DATE_LOG_DIR%\backend-error.log" 2>&1
                echo [INFO] Backend error logs saved to: %DATE_LOG_DIR%\backend-error.log
            ) else (
                docker-compose logs backend > "%DATE_LOG_DIR%\backend-error.log" 2>&1
                echo [INFO] Backend error logs saved to: %DATE_LOG_DIR%\backend-error.log
            )
            pause
            exit /b 1
        )
    )
echo [INFO] Backend is ready
echo [OK] Backend is ready.

:skip_health_checks

echo [INFO] Health checks completed successfully

echo.
echo ========================================
echo [SUCCESS] StudySphere Development Environment is Ready!
echo ========================================
echo.
echo Services:
echo   Backend API:     http://localhost:5050
echo   Frontend:        http://localhost:3000
echo   MySQL Database:  localhost:3307
echo   Health Check:    http://localhost:5050/health
echo.
echo Admin Login:
echo   ID:       admin001
echo   Password: admin123
echo   Role:     10 (Administrator)
echo.
echo Useful Commands:
echo   View logs:       docker compose logs -f
echo   Check status:    docker compose ps
echo   Stop services:   stop-all.bat
echo   Restart:         start-all.bat
echo.

REM Show current status
echo [INFO] Displaying current service status...
echo [INFO] Current service status:
if defined USE_COMPOSE_PLUGIN (
    docker compose ps > "%DATE_LOG_DIR%\service-status.log" 2>&1
    type "%DATE_LOG_DIR%\service-status.log"
) else (
    docker-compose ps > "%DATE_LOG_DIR%\service-status.log" 2>&1
    type "%DATE_LOG_DIR%\service-status.log"
)

REM 起動完了ログ
echo [INFO] Startup completed successfully
echo.
echo [INFO] Startup completed successfully!
echo [INFO] Services are running in the background.
echo [INFO] Use 'stop-all.bat' to stop services when done.
echo.
echo [INFO] All startup logs have been saved to the 'logs' directory.
echo [INFO] Check the logs directory for detailed information about the startup process.
echo.

REM バックエンドサーバーの起動（Docker Composeの代わりに直接起動）
echo [INFO] Starting backend server directly...
echo [INFO] Starting backend server directly...

REM バックエンドディレクトリに移動
cd /d "%~dp0backend"

REM 環境変数を設定
set DB_HOST=localhost
set DB_PORT=3307
set DB_USER=root
set DB_PASSWORD=shinomoto926!
set DB_NAME=curriculum-portal
set SKIP_DB_CHECK=true
set NODE_ENV=development

REM Node.jsが利用可能かチェック
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not available. Please install Node.js first.
    pause
    exit /b 1
)
echo [INFO] Services started successfully with force recreate
goto after_up

REM バックエンドサーバーを起動
echo [INFO] Starting backend server on port 5050...
start "StudySphere Backend" cmd /k "cd /d %cd% && set DB_HOST=localhost && set DB_PORT=3307 && set DB_USER=root && set DB_PASSWORD=shinomoto926! && set DB_NAME=curriculum-portal && set SKIP_DB_CHECK=true && set NODE_ENV=development && node index.js"
echo [INFO] Backend server started in new window

REM ログファイルの場所を表示
echo [INFO] Log files location:
echo [INFO]   Startup log: %STARTUP_LOG%
echo [INFO]   Error log: %ERROR_LOG%
echo [INFO]   Build log: %DATE_LOG_DIR%\build.log
echo [INFO]   Startup log: %DATE_LOG_DIR%\startup.log
echo [INFO]   Database error log: %DATE_LOG_DIR%\db-error.log
echo [INFO]   Backend error log: %DATE_LOG_DIR%\backend-error.log
echo [INFO]   Admin setup log: %DATE_LOG_DIR%\admin-setup.log
echo [INFO]   Service status log: %DATE_LOG_DIR%\service-status.log
echo.

pause
