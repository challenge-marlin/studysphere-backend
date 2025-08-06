@echo off
chcp 65001 >nul
echo [INFO] AI-Skill-Curriculum Backend System Starting...

REM Clean up existing containers (first time only)
if not exist ".initialized" (
    echo [INFO] First time startup - initializing database...
    
    REM Try to backup existing data
    echo [INFO] Attempting to backup existing data...
    docker-compose up -d db
    timeout /t 15 /nobreak >nul
    
    REM Execute backup script
    docker exec -i mysql_db mysql -u root -pshinomoto926! curriculum-portal < db/backup-database.sql >nul 2>&1
    if %errorlevel% equ 0 (
        echo [SUCCESS] Data backup completed
    ) else (
        echo [WARNING] Backup failed (possibly new database)
    )
    
    REM Stop containers but preserve volumes
    docker-compose down
    echo [SUCCESS] Container cleanup completed (volumes preserved)
)

REM Start backend services with Docker Compose
echo [INFO] Starting containers...
docker-compose up -d

REM Wait for database to be ready
echo [INFO] Waiting for database to be ready...
timeout /t 30 /nobreak >nul

REM Check database initialization and load initial data
echo [INFO] Checking database initialization...
docker exec mysql_db mysql -u root -pshinomoto926! -e "USE curriculum-portal; SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'curriculum-portal';" >nul 2>&1

if %errorlevel% neq 0 (
    echo [ERROR] Database initialization failed. Executing manual initialization...
    docker exec -i mysql_db mysql -u root -pshinomoto926! curriculum-portal < db/init.sql
    echo [SUCCESS] Manual initialization completed
)

REM Restore backup data
echo [INFO] Attempting to restore backup data...
docker exec -i mysql_db mysql -u root -pshinomoto926! curriculum-portal < db/restore-backup.sql >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Backup data restoration completed
) else (
    echo [WARNING] No backup data found (new database)
)

REM Check initial data
echo [INFO] Checking initial data...
docker exec mysql_db mysql -u root -pshinomoto926! -e "USE curriculum-portal; SELECT COUNT(*) as admin_count FROM admin_credentials;" >nul 2>&1

if %errorlevel% neq 0 (
    echo [WARNING] Initial data is missing. Loading initial data...
    if exist "db/restore-admin.sql" (
        docker exec -i mysql_db mysql -u root -pshinomoto926! curriculum-portal < db/restore-admin.sql
        echo [SUCCESS] Initial data loading completed
    )
)

REM Create initialization completion flag
echo. > .initialized

echo [SUCCESS] Backend services started successfully!
echo.
echo [INFO] Backend API: http://localhost:5000
echo [INFO] Database: localhost:3307
echo.
echo [HOT RELOAD] ホットリロードが有効です
echo [HOT RELOAD] ファイルを編集すると自動的にサーバーが再起動します
echo [HOT RELOAD] 監視対象: *.js, *.json, *.sql ファイル
echo [HOT RELOAD] リアルタイムログ: docker-compose logs -f backend
echo.
echo [INFO] To view logs: docker-compose logs -f
echo [INFO] To stop: docker-compose down
echo [INFO] To reset database: reset-database.bat
echo [INFO] Data persistence: ENABLED (データは永続化されます)
echo [INFO] Data backup/restore functionality is enabled
echo.
echo [INFO] To start frontend:
echo    cd ../front/reactStudySphereMockup ^&^& docker-compose up -d
pause 