# StudySphere Development Environment Startup Script (PowerShell)
# このスクリプトはウィンドウを開いたままにします

Write-Host "[INFO] Starting StudySphere Development Environment..." -ForegroundColor Green
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "[INFO] Docker is running. Proceeding with startup..." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if database volume exists
Write-Host "[INFO] Checking database volume..." -ForegroundColor Yellow
$volumeExists = docker volume ls | Select-String "studysphere-backend_mysql_data"
if ($volumeExists) {
    Write-Host "[INFO] Database volume found. Preserving existing data." -ForegroundColor Green
    $FRESH_INSTALL = $false
} else {
    Write-Host "[INFO] Database volume not found. This is a fresh installation." -ForegroundColor Yellow
    $FRESH_INSTALL = $true
}

# Stop only backend container (keep database data)
Write-Host "[INFO] Stopping backend container..." -ForegroundColor Yellow
docker-compose stop backend | Out-Null

# Start database and backend
Write-Host "[INFO] Starting database and backend services..." -ForegroundColor Yellow
docker-compose up -d

# Wait for database to be ready
Write-Host "[INFO] Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Check if database is ready
Write-Host "[INFO] Checking database connection..." -ForegroundColor Yellow
$dbReady = $false
for ($i = 0; $i -lt 3; $i++) {
    try {
        docker-compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! | Out-Null
        $dbReady = $true
        break
    } catch {
        Write-Host "[WARNING] Database not ready yet, waiting additional 10 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
    }
}

if (-not $dbReady) {
    Write-Host "[ERROR] Database connection failed. Please check Docker logs." -ForegroundColor Red
    docker-compose logs db
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[INFO] Database is ready." -ForegroundColor Green

# Check if database is initialized
Write-Host "[INFO] Checking database initialization..." -ForegroundColor Yellow
$tableCount = docker-compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'curriculum-portal';" 2>$null

if ([string]::IsNullOrEmpty($tableCount)) {
    Write-Host "[INFO] Database appears to be empty, initializing..." -ForegroundColor Yellow
    Get-Content db/init.sql | docker-compose exec -T db mysql -u root -pshinomoto926! curriculum-portal
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Database initialization failed." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[INFO] Database initialized successfully." -ForegroundColor Green
} else {
    Write-Host "[INFO] Database already initialized with $tableCount tables. Data preserved." -ForegroundColor Green
}

# Create or update admin account with role 10
Write-Host "[INFO] Creating/updating admin account..." -ForegroundColor Yellow
docker-compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e @"
INSERT IGNORE INTO companies (id, name) VALUES (1, 'アドミニストレータ');
INSERT IGNORE INTO user_accounts (id, name, role, status, login_code, company_id) VALUES (1, 'admin001', 10, 1, 'ADMN-0001-0001', 1);
INSERT IGNORE INTO admin_credentials (user_id, username, password_hash) VALUES (1, 'admin001', '\$2a\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O');
UPDATE user_accounts SET role = 10 WHERE name = 'admin001';
"@

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Admin account creation failed." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[INFO] Admin account created/updated successfully." -ForegroundColor Green

# Verify admin account
Write-Host "[INFO] Verifying admin account..." -ForegroundColor Yellow
docker-compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e @"
SELECT 
    ua.id,
    ua.name,
    ua.role,
    ua.status,
    ac.username,
    ac.created_at
FROM user_accounts ua
LEFT JOIN admin_credentials ac ON ua.id = ac.user_id
WHERE ua.role >= 9;
"@

# Wait for backend to be ready
Write-Host "[INFO] Waiting for backend to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check backend health
Write-Host "[INFO] Checking backend health..." -ForegroundColor Yellow
$backendReady = $false
for ($i = 0; $i -lt 3; $i++) {
    try {
        Invoke-WebRequest -Uri "http://localhost:5000/" -UseBasicParsing | Out-Null
        $backendReady = $true
        break
    } catch {
        Write-Host "[WARNING] Backend not ready yet, waiting additional 10 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
    }
}

if (-not $backendReady) {
    Write-Host "[ERROR] Backend health check failed. Please check Docker logs." -ForegroundColor Red
    docker-compose logs backend
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "[SUCCESS] StudySphere Development Environment is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "[INFO] Backend API: http://localhost:5000" -ForegroundColor Cyan
Write-Host "[INFO] Database: localhost:3307" -ForegroundColor Cyan
Write-Host "[INFO] Admin Login: admin001 / admin123 (Role: 10)" -ForegroundColor Cyan
if ($FRESH_INSTALL) {
    Write-Host "[INFO] This was a fresh installation." -ForegroundColor Yellow
} else {
    Write-Host "[INFO] Existing data was preserved." -ForegroundColor Green
}
Write-Host ""
Write-Host "[INFO] To start frontend:" -ForegroundColor Yellow
Write-Host "   cd ../studysphere-frontend && npm start" -ForegroundColor White
Write-Host ""
Write-Host "[INFO] Available commands:" -ForegroundColor Yellow
Write-Host "   docker-compose stop    - Stop all services" -ForegroundColor White
Write-Host "   docker-compose logs    - View logs" -ForegroundColor White
Write-Host "   docker-compose down    - Stop and remove containers" -ForegroundColor White
Write-Host "   docker volume rm studysphere-backend_mysql_data  - Reset database (WARNING: All data will be lost!)" -ForegroundColor White
Write-Host ""
Write-Host "[INFO] Starting live backend logs..." -ForegroundColor Yellow
Write-Host "[INFO] Press Ctrl+C to stop the logs and close this window" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

# Show live backend logs (this will keep the window open)
try {
    docker-compose logs -f backend
} catch {
    Write-Host ""
    Write-Host "[INFO] Logs stopped." -ForegroundColor Yellow
}

# Keep window open after logs are stopped
Write-Host ""
Write-Host "[INFO] Press any key to close this window..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
