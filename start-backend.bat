@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo StudySphere Backend Development
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

echo [INFO] Starting MySQL Database and Backend Server...
echo.

REM Stop only backend container (keep database data)
echo [INFO] Stopping backend container...
docker-compose stop backend >nul 2>&1

REM Start database and backend
echo [INFO] Starting services...
docker-compose up -d

REM Wait for database to be ready
echo [INFO] Waiting for database to be ready...
timeout /t 15 /nobreak >nul

REM Check database connection
echo [INFO] Checking database connection...
docker-compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Database not ready, waiting additional 10 seconds...
    timeout /t 10 /nobreak >nul
    docker-compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Database connection failed.
        docker-compose logs db
        pause
        exit /b 1
    )
)

echo [INFO] Database is ready.

REM Check if admin account exists and update role to 10
echo [INFO] Checking and updating admin account...
docker-compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "
INSERT IGNORE INTO companies (id, name) VALUES (1, 'アドミニストレータ');
INSERT IGNORE INTO user_accounts (id, name, role, status, login_code, company_id) VALUES (1, 'admin001', 10, 1, 'ADMN-0001-0001', 1);
INSERT IGNORE INTO admin_credentials (user_id, username, password_hash) VALUES (1, 'admin001', '\$2a\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O');
UPDATE user_accounts SET role = 10 WHERE name = 'admin001';
"

echo [INFO] Admin account ready.

REM Wait for backend to be ready
echo [INFO] Waiting for backend to be ready...
timeout /t 10 /nobreak >nul

REM Check backend health
echo [INFO] Checking backend health...
curl -f http://localhost:5000/ >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Backend not ready, waiting additional 10 seconds...
    timeout /t 10 /nobreak >nul
    curl -f http://localhost:5000/ >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Backend health check failed.
        docker-compose logs backend
        pause
        exit /b 1
    )
)

echo.
echo [SUCCESS] Services are ready!
echo.
echo Backend API: http://localhost:5000
echo MySQL Database: localhost:3307
echo Admin Login: admin001 / admin123 (Role: 10)
echo.
echo Press Ctrl+C to stop all services
echo ========================================
echo.

REM Show hot reload logs
docker-compose logs -f backend 