#!/usr/bin/env bash
set -e

# スクリプトのディレクトリに移動
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

LOG_DIR="logs"
# 日付ベースのディレクトリ (YYYY/MM/DD)
TODAY_YEAR=$(date +%Y)
TODAY_MONTH=$(date +%m)
TODAY_DATE=$(date +%d)
DATE_LOG_DIR="${LOG_DIR}/${TODAY_YEAR}/${TODAY_MONTH}/${TODAY_DATE}"
STARTUP_LOG="${DATE_LOG_DIR}/startup.log"
ERROR_LOG="${DATE_LOG_DIR}/startup-errors.log"

mkdir -p "$DATE_LOG_DIR"

# 起動ログの開始
{
  echo "[$(date)] ========================================"
  echo "[$(date)] StudySphere Development Environment Startup"
  echo "[$(date)] ========================================"
  echo "[$(date)] Script: $0"
  echo "[$(date)] Working Directory: $SCRIPT_DIR"
  echo "[$(date)] User: $(whoami)"
  echo "[$(date)] Computer: $(hostname)"
  echo "[$(date)] OS: $(uname -s)"
  echo "[$(date)] ========================================"
} > "$STARTUP_LOG"

echo "[$(date)] Startup Error Log Started" > "$ERROR_LOG"

echo "========================================"
echo "StudySphere Development Environment"
echo "========================================"
echo "[INFO] This script starts the complete development environment"
echo "[INFO] Run without args to show interactive menu."
echo "[INFO] Or specify directly: ./start-all.sh [recreate|rebuild|quick]"
echo "[INFO]   quick    : Fast startup (no health checks)"
echo "[INFO]   recreate : Force recreate containers (no rebuild)"
echo "[INFO]   rebuild  : Rebuild images then recreate"
echo ""

echo "[INFO] Startup script execution started"

# モード引数の解析
MODE="${1:-default}"
echo "[INFO] Startup mode: $MODE"
echo ""

# 引数なしの場合は対話メニュー
if [ $# -eq 0 ]; then
  while true; do
    echo "[INFO] Interactive menu displayed"
    echo "[INFO] Select startup mode:"
    echo "  1) Normal (with health checks)"
    echo "  2) Quick (fast startup, minimal checks)"
    echo "  3) Recreate (--force-recreate)"
    echo "  4) Rebuild + Recreate (build -> up --force-recreate)"
    printf "Enter a number [1-4] > "
    read -r CHOICE
    case "$CHOICE" in
      1) MODE=default; break ;;
      2) MODE=quick; break ;;
      3) MODE=recreate; break ;;
      4) MODE=rebuild; break ;;
      *) echo "[WARN] Invalid choice. Please choose 1-4."; echo "" ;;
    esac
  done
fi

echo "[INFO] Selected mode: $MODE"
echo ""

# Docker 確認
echo "[INFO] Checking Docker availability..."
if ! docker info >/dev/null 2>&1; then
  echo "[ERROR] Docker is not running. Please start Docker Desktop first."
  exit 1
fi
echo "[OK] Docker is running."

# Docker Compose コマンドの検出
echo "[INFO] Detecting Docker Compose command..."
USE_COMPOSE_PLUGIN=
if docker compose version >/dev/null 2>&1; then
  USE_COMPOSE_PLUGIN=1
fi
if [ -z "$USE_COMPOSE_PLUGIN" ]; then
  if ! docker-compose version >/dev/null 2>&1; then
    echo "[ERROR] Neither 'docker compose' nor 'docker-compose' is available in PATH."
    echo "[HINT] Install Docker Desktop or ensure PATH includes Docker binaries."
    exit 1
  fi
fi
echo "[OK] Docker Compose available."

# docker-compose.yml の存在確認
if [ ! -f "docker-compose.yml" ]; then
  echo "[ERROR] docker-compose.yml not found in: $SCRIPT_DIR"
  echo "[HINT] Please run this script from 'studysphere-backend' directory."
  exit 1
fi
echo "[INFO] docker-compose.yml found successfully"

# 既存サービスの停止
echo "[INFO] Stopping any existing services..."
if [ -n "$USE_COMPOSE_PLUGIN" ]; then
  docker compose down >/dev/null 2>&1 || echo "[WARN] Failed to stop existing services with docker compose down"
else
  docker-compose down >/dev/null 2>&1 || echo "[WARN] Failed to stop existing services with docker-compose down"
fi
echo "[INFO] Existing services stopped successfully"

# リビルドモードの場合はイメージをビルド
if [ "$MODE" = "rebuild" ]; then
  echo "[INFO] Building backend image (this may take several minutes)..."
  echo "[INFO] Build progress will be displayed below:"
  echo ""
  docker build --no-cache --progress=plain -t studysphere-backend:latest ./backend
  if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Failed to build backend image."
    exit 1
  fi
  echo ""
  echo "[OK] Backend image built successfully."
fi

# サービスの起動
do_up_recreate() {
  echo "[INFO] Starting services with force recreate..."
  if [ -n "$USE_COMPOSE_PLUGIN" ]; then
    docker compose up -d --force-recreate >> "$STARTUP_LOG" 2>&1
  else
    docker-compose up -d --force-recreate >> "$STARTUP_LOG" 2>&1
  fi
  COMPOSE_EXIT_CODE=$?
  if [ $COMPOSE_EXIT_CODE -ne 0 ]; then
    echo "[ERROR] Failed to start services with force recreate. Exit code: $COMPOSE_EXIT_CODE"
    echo "[ERROR] Check startup.log for details."
    cat "$STARTUP_LOG"
    exit 1
  fi
  echo "[INFO] Services started successfully with force recreate"
}

do_up_default() {
  echo "[INFO] Starting services normally..."
  if [ -n "$USE_COMPOSE_PLUGIN" ]; then
    docker compose up -d >> "$STARTUP_LOG" 2>&1
  else
    docker-compose up -d >> "$STARTUP_LOG" 2>&1
  fi
  COMPOSE_EXIT_CODE=$?
  if [ $COMPOSE_EXIT_CODE -ne 0 ]; then
    echo "[ERROR] Failed to start services. Exit code: $COMPOSE_EXIT_CODE"
    echo "[ERROR] Check startup.log for details."
    cat "$STARTUP_LOG"
    exit 1
  fi
  echo "[INFO] Services started successfully"
}

if [ "$MODE" = "recreate" ] || [ "$MODE" = "rebuild" ]; then
  do_up_recreate
else
  do_up_default
fi

# 起動ログの警告チェック
echo "[INFO] Checking startup logs for any warnings or errors..."
if [ -f "$STARTUP_LOG" ]; then
  if grep -qiE "error|warning|failed|exception" "$STARTUP_LOG" 2>/dev/null; then
    echo "[WARN] Startup logs contain warnings or errors. Review startup.log for details."
  fi
fi

echo "[OK] Services started successfully!"
echo ""

# クイックモードではヘルスチェックをスキップ
if [ "$MODE" != "quick" ]; then
  echo "[INFO] Starting health checks..."
  echo "[INFO] Waiting for services to be ready..."
  echo "[INFO] This may take a few minutes on first startup..."
  echo ""

  # DB 待機
  echo "[INFO] Waiting for database to be ready..."
  sleep 20

  echo "[INFO] Checking database connection..."
  if [ -n "$USE_COMPOSE_PLUGIN" ]; then
    docker compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! >/dev/null 2>&1
  else
    docker-compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! >/dev/null 2>&1
  fi
  DB_CHECK_RESULT=$?

  if [ $DB_CHECK_RESULT -ne 0 ]; then
    echo "[WARN] Database not ready, waiting additional 15 seconds..."
    sleep 15
    if [ -n "$USE_COMPOSE_PLUGIN" ]; then
      docker compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! >/dev/null 2>&1
    else
      docker-compose exec -T db mysqladmin ping -h localhost -u root -pshinomoto926! >/dev/null 2>&1
    fi
    DB_CHECK_RESULT=$?
    if [ $DB_CHECK_RESULT -ne 0 ]; then
      echo "[ERROR] Database connection failed after retry."
      if [ -n "$USE_COMPOSE_PLUGIN" ]; then
        docker compose logs db > "${DATE_LOG_DIR}/db-error.log" 2>&1
      else
        docker-compose logs db > "${DATE_LOG_DIR}/db-error.log" 2>&1
      fi
      echo "[INFO] Database error logs saved to: ${DATE_LOG_DIR}/db-error.log"
      exit 1
    fi
  fi
  echo "[OK] Database is ready."

  # 管理者アカウントの確認・更新
  echo "[INFO] Checking and updating admin account..."
  ADMIN_SQL="INSERT IGNORE INTO companies (id, name) VALUES (1, 'アドミニストレータ'); INSERT IGNORE INTO user_accounts (id, name, role, status, login_code, company_id) VALUES (1, 'admin001', 10, 1, 'ADMN-0001-0001', 1); INSERT IGNORE INTO admin_credentials (user_id, username, password_hash) VALUES (1, 'admin001', '\$2a\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O'); UPDATE user_accounts SET role = 10 WHERE name = 'admin001';"
  if [ -n "$USE_COMPOSE_PLUGIN" ]; then
    docker compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "$ADMIN_SQL" > "${DATE_LOG_DIR}/admin-setup.log" 2>&1
  else
    docker-compose exec -T db mysql -u root -pshinomoto926! curriculum-portal -e "$ADMIN_SQL" > "${DATE_LOG_DIR}/admin-setup.log" 2>&1
  fi
  ADMIN_SETUP_RESULT=$?
  if [ $ADMIN_SETUP_RESULT -ne 0 ]; then
    echo "[WARN] Admin account setup completed with warnings. Check admin-setup.log for details."
  else
    echo "[INFO] Admin account setup completed successfully"
  fi
  echo "[OK] Admin account ready."

  # バックエンド待機
  echo "[INFO] Waiting for backend to be ready..."
  sleep 15

  echo "[INFO] Checking backend health..."
  BACKEND_CHECK_RESULT=1
  if curl -sf http://localhost:5050/ >/dev/null 2>&1; then
    BACKEND_CHECK_RESULT=0
  fi
  if [ $BACKEND_CHECK_RESULT -ne 0 ]; then
    echo "[WARN] Backend not ready, waiting additional 15 seconds..."
    sleep 15
    if curl -sf http://localhost:5050/ >/dev/null 2>&1; then
      BACKEND_CHECK_RESULT=0
    fi
    if [ $BACKEND_CHECK_RESULT -ne 0 ]; then
      echo "[ERROR] Backend health check failed after retry."
      if [ -n "$USE_COMPOSE_PLUGIN" ]; then
        docker compose logs backend > "${DATE_LOG_DIR}/backend-error.log" 2>&1
      else
        docker-compose logs backend > "${DATE_LOG_DIR}/backend-error.log" 2>&1
      fi
      echo "[INFO] Backend error logs saved to: ${DATE_LOG_DIR}/backend-error.log"
      exit 1
    fi
  fi
  echo "[OK] Backend is ready."
fi

echo "[INFO] Health checks completed successfully"
echo ""

echo "========================================"
echo "[SUCCESS] StudySphere Development Environment is Ready!"
echo "========================================"
echo ""
echo "Services:"
echo "  Backend API:     http://localhost:5050"
echo "  Frontend:        http://localhost:3000"
echo "  MySQL Database:  localhost:3307"
echo "  Health Check:    http://localhost:5050/health"
echo ""
echo "Admin Login:"
echo "  ID:       admin001"
echo "  Password: admin123"
echo "  Role:     10 (Administrator)"
echo ""
echo "Useful Commands:"
echo "  View logs:       docker compose logs -f   (or docker-compose logs -f)"
echo "  Check status:    docker compose ps         (or docker-compose ps)"
echo "  Stop services:   ./stop-all.sh"
echo "  Restart:         ./start-all.sh"
echo ""

# 現在のステータス表示
echo "[INFO] Displaying current service status..."
if [ -n "$USE_COMPOSE_PLUGIN" ]; then
  docker compose ps 2>&1 | tee "${DATE_LOG_DIR}/service-status.log"
else
  docker-compose ps 2>&1 | tee "${DATE_LOG_DIR}/service-status.log"
fi

echo ""
echo "[INFO] Startup completed successfully!"
echo "[INFO] Services are running in the background."
echo "[INFO] Use './stop-all.sh' to stop services when done."
echo "[INFO] All startup logs have been saved to the 'logs' directory."
echo "[INFO] Backend API is provided by Docker container on port 5050."
echo ""
echo "[INFO] Log files location:"
echo "[INFO]   Startup log: $STARTUP_LOG"
echo "[INFO]   Error log: $ERROR_LOG"
echo "[INFO]   Startup log: ${DATE_LOG_DIR}/startup.log"
echo "[INFO]   Database error log: ${DATE_LOG_DIR}/db-error.log"
echo "[INFO]   Backend error log: ${DATE_LOG_DIR}/backend-error.log"
echo "[INFO]   Admin setup log: ${DATE_LOG_DIR}/admin-setup.log"
echo "[INFO]   Service status log: ${DATE_LOG_DIR}/service-status.log"
echo ""
