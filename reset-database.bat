@echo off
chcp 65001 >nul

echo ========================================
echo StudySphere Database Reset
echo ========================================
echo.
echo [WARNING] This will completely reset the database and delete ALL data!
echo.
set /p confirm="Are you sure you want to continue? (y/N): "

if /i not "%confirm%"=="y" (
    echo [INFO] Database reset cancelled.
    pause
    exit /b 0
)

echo.
echo [INFO] Stopping all services...
docker-compose down

echo [INFO] Removing database volume...
docker volume rm studysphere-backend_mysql_data >nul 2>&1

echo [INFO] Starting fresh installation...
docker-compose up -d

echo [INFO] Waiting for database to be ready...
timeout /t 20 /nobreak >nul

echo [INFO] Initializing database...
docker-compose exec -T db mysql -u root -pshinomoto926! curriculum-portal < db/init.sql

echo [INFO] Creating admin account...
docker-compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "
INSERT IGNORE INTO companies (id, name) VALUES (1, 'アドミニストレータ');
INSERT IGNORE INTO user_accounts (id, name, role, status, login_code, company_id) VALUES (1, 'admin001', 10, 1, 'ADMN-0001-0001', 1);
INSERT IGNORE INTO admin_credentials (user_id, username, password_hash) VALUES (1, 'admin001', '\$2a\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O');
UPDATE user_accounts SET role = 10 WHERE name = 'admin001';
"

echo.
echo [SUCCESS] Database has been reset successfully!
echo.
echo [INFO] Backend API: http://localhost:5000
echo [INFO] Database: localhost:3307
echo [INFO] Admin Login: admin001 / admin123 (Role: 10)
echo.
pause 