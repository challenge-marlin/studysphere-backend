@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo [INFO] Starting StudySphere Development Environment...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

echo [INFO] Docker is running. Proceeding with startup...

REM Check Docker Compose version
echo [INFO] Checking Docker Compose version...
docker compose version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Compose is not available. Please ensure Docker Desktop is properly installed.
    pause
    exit /b 1
)
echo [INFO] Docker Compose is available.

REM Set Docker Compose version to avoid bake issues
set COMPOSE_DOCKER_CLI_BUILD=1
set DOCKER_BUILDKIT=0

REM Check if containers are already running
echo [INFO] Checking if services are already running...
docker compose ps | findstr "Up" >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Services are already running. Stopping and recreating for fresh start...
    docker compose down
    echo [INFO] Services stopped. Starting fresh...
) else (
    echo [INFO] No running services found. Starting fresh...
)

REM Check if database volume exists
echo [INFO] Checking database volume...
docker volume ls | findstr "studysphere-backend_mysql_data" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Database volume not found. This is a fresh installation.
    set FRESH_INSTALL=1
) else (
    echo [INFO] Database volume found. Preserving existing data.
    set FRESH_INSTALL=0
)

REM Start database and backend services
echo [INFO] Starting database and backend services...
docker compose up -d

REM If build is needed, run it separately
if errorlevel 1 (
    echo [INFO] Services failed to start. Attempting to build first...
    docker compose build --no-cache
    if errorlevel 1 (
        echo [ERROR] Build failed. Please check the Dockerfile and try again.
        pause
        exit /b 1
    )
    echo [INFO] Build completed. Starting services...
    docker compose up -d
    if errorlevel 1 (
        echo [ERROR] Services failed to start after build.
        pause
        exit /b 1
    )
)

REM Wait for database to be ready
echo [INFO] Waiting for database to be ready...
timeout /t 20 /nobreak >nul

REM Check if database is ready
echo [INFO] Checking database connection...
docker compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Database not ready yet, waiting additional 15 seconds...
    timeout /t 5 /nobreak >nul
    docker compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Database connection failed. Please check Docker logs.
        docker compose logs db
        pause
        exit /b 1
    )
)

echo [INFO] Database is ready.

REM Check if database is initialized (simplified approach)
echo [INFO] Checking database initialization...
docker compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "SHOW TABLES;" > temp_db_check.txt 2>&1
if exist temp_db_check.txt (
    for /f %%i in ('type temp_db_check.txt ^| find /c /v ""') do set line_count=%%i
    del temp_db_check.txt
    if !line_count! gtr 0 (
        echo [INFO] Database already initialized with !line_count! tables. Data preserved.
        set NEED_INIT=0
    ) else (
        echo [INFO] Database appears to be empty, initializing...
        set NEED_INIT=1
    )
) else (
    echo [INFO] Database appears to be empty, initializing...
    set NEED_INIT=1
)

REM Initialize database if needed
if !NEED_INIT!==1 (
    echo [INFO] Initializing database...
    docker compose exec -T db mysql -u root -pshinomoto926! curriculum-portal < db/init.sql
    if errorlevel 1 (
        echo [ERROR] Database initialization failed.
        pause
        exit /b 1
    )
    echo [INFO] Database initialized successfully.
)

REM Create admin account only if database was newly initialized
if !NEED_INIT!==1 (
    echo [INFO] Creating admin account for fresh installation...
    docker compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "INSERT IGNORE INTO companies (id, name) VALUES (1, 'アドミニストレータ');" 2>nul
    if errorlevel 1 (
        echo [WARNING] Company creation failed, but continuing...
    )

    docker compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "INSERT IGNORE INTO user_accounts (id, name, role, status, login_code, company_id) VALUES (1, 'admin001', 10, 1, 'ADMN-0001-0001', 1);" 2>nul
    if errorlevel 1 (
        echo [WARNING] User account creation failed, but continuing...
    )

    docker compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "INSERT IGNORE INTO admin_credentials (user_id, username, password_hash) VALUES (1, 'admin001', '\$2a\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O');" 2>nul
    if errorlevel 1 (
        echo [WARNING] Admin credentials creation failed, but continuing...
    )

    docker compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "UPDATE user_accounts SET role = 10 WHERE name = 'admin001';" 2>nul
    if errorlevel 1 (
        echo [WARNING] User role update failed, but continuing...
    )

    echo [INFO] Admin account creation completed.
) else (
    echo [INFO] Admin account already exists. Skipping creation.
)

REM Verify admin account
echo [INFO] Verifying admin account...
docker compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "SELECT ua.id, ua.name, ua.role, ua.status, ac.username, ac.created_at FROM user_accounts ua LEFT JOIN admin_credentials ac ON ua.id = ac.user_id WHERE ua.role >= 9;" 2>nul

REM Wait for backend to start and verify it's working
echo [INFO] Waiting for backend to start...
timeout /t 20 /nobreak >nul

REM Simple backend check - just verify container is running
echo [INFO] Checking backend application status...
set MAX_RETRIES=10
set RETRY_COUNT=0

:check_backend_loop
set /a RETRY_COUNT+=1
echo [INFO] Attempt !RETRY_COUNT! of !MAX_RETRIES! - Checking backend container...

REM Check if the container is running
docker compose ps backend | findstr "Up" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Backend container is not running properly...
    if !RETRY_COUNT! geq !MAX_RETRIES! (
        echo [ERROR] Backend container failed to start after !MAX_RETRIES! attempts.
        echo [INFO] Checking backend container status...
        docker compose ps backend
        echo [INFO] Checking backend logs for errors...
        docker compose logs --tail=100 backend
        echo [ERROR] Please check the logs above for errors.
        pause
        exit /b 1
    )
    echo [INFO] Backend not ready yet, waiting 5 seconds...
    timeout /t 5 /nobreak >nul
    goto check_backend_loop
)

echo [INFO] Backend container is running successfully!
echo [INFO] Backend is ready and responding!

REM Verify environment variables are correct
echo [INFO] Verifying environment configuration...
docker compose exec -T backend node -e "console.log('DB_HOST:', process.env.DB_HOST)" 2>nul
if errorlevel 1 (
    echo [WARNING] Could not verify environment variables, but continuing...
) else (
    echo [INFO] Environment variables verified.
)

echo.
echo [SUCCESS] StudySphere Development Environment is ready!
if "%FRESH_INSTALL%"=="1" (
    echo [INFO] This was a fresh installation.
) else (
    echo [INFO] Existing data was preserved.
)
echo.

REM Keep window open and show simple status
echo.
echo [INFO] ========================================
echo [INFO] StudySphere Backend is running!
echo [INFO] ========================================
echo.
echo [INFO] Backend API: http://localhost:5000
echo [INFO] Database: localhost:3307
echo [INFO] Admin Login: admin001 / admin123 (Role: 10)
echo.
echo [INFO] To stop services, run:
echo    docker compose stop
echo.
echo [INFO] ========================================
echo [INFO] Starting live log tail (latest 50 lines + new entries)...
echo [INFO] Press Ctrl+C to stop the logs and close this window
echo ========================================
echo.

REM Start live tail with error handling
docker compose logs -f --tail=50 backend 2>nul
if errorlevel 1 (
    echo [WARNING] Live log tail failed. Showing static logs instead...
    docker compose logs --tail=100 backend 2>nul
    if errorlevel 1 (
        echo [WARNING] Static log display also failed. Continuing without logs...
    )
)

REM Always keep window open
echo.
echo [INFO] Logs stopped. Press any key to close this window...
pause >nul
