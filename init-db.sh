#!/usr/bin/env bash
# DB にテーブルが存在しない場合に init.sql を流して初期化するスクリプト
# 使い方: ./init-db.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "[INFO] Initializing database with init.sql..."
echo "[INFO] This creates tables (admin_credentials, user_accounts, etc.) and the admin user (admin001 / admin123)."
echo ""

if ! docker compose exec -T db mysql -u root -pshinomoto926! curriculum-portal < db/init.sql; then
  echo "[ERROR] Failed to run init.sql. Make sure Docker is running and 'docker compose up -d' has been executed."
  exit 1
fi

echo ""
echo "[OK] Database initialized successfully."
echo "[INFO] You can now log in with: ID=admin001, Password=admin123"
echo ""
