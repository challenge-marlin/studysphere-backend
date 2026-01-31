#!/usr/bin/env bash

echo "========================================"
echo "StudySphere Development Environment"
echo "========================================"
echo "[INFO] Stopping all services..."
echo ""

# Node.js プロセス（バックエンド・フロントエンド）の停止
echo "[INFO] Stopping Node.js processes..."
if pkill -f "node" 2>/dev/null; then
  echo "[OK] Node.js processes stopped."
else
  echo "[INFO] No Node.js processes found."
fi
echo ""

# Docker の稼働確認
if ! docker info >/dev/null 2>&1; then
  echo "[WARNING] Docker is not running. Nothing to stop."
  exit 0
fi

# Docker Compose コマンドの検出
USE_COMPOSE_PLUGIN=
docker compose version >/dev/null 2>&1 && USE_COMPOSE_PLUGIN=1

# サービスが動いているか確認
RUNNING=
if [ -n "$USE_COMPOSE_PLUGIN" ]; then
  RUNNING=$(docker compose ps 2>/dev/null | grep -c "Up" || true)
else
  RUNNING=$(docker-compose ps 2>/dev/null | grep -c "Up" || true)
fi

if [ -z "$RUNNING" ] || [ "$RUNNING" -eq 0 ]; then
  echo "[INFO] No services are currently running."
  exit 0
fi

# サービスの停止
echo "[INFO] Stopping services gracefully..."
if [ -n "$USE_COMPOSE_PLUGIN" ]; then
  docker compose down
else
  docker-compose down
fi

if [ $? -ne 0 ]; then
  echo "[WARNING] Some services may not have stopped cleanly."
  echo "[INFO] You can force stop with: docker compose down --remove-orphans"
  echo "[INFO] Or: docker-compose down --remove-orphans"
else
  echo "[OK] All services stopped successfully."
fi

echo ""

# Docker リソースのクリーンアップ（ボリュームはデータ保持のため除外）
echo "[INFO] Cleaning up Docker resources..."
echo "[INFO] Removing stopped containers..."
if docker container prune -f >/dev/null 2>&1; then
  echo "[OK] Stopped containers removed."
else
  echo "[WARNING] Failed to clean up stopped containers."
fi

echo "[INFO] Removing unused images..."
if docker image prune -f >/dev/null 2>&1; then
  echo "[OK] Unused images removed."
else
  echo "[WARNING] Failed to clean up unused images."
fi

echo "[INFO] Removing unused networks..."
if docker network prune -f >/dev/null 2>&1; then
  echo "[OK] Unused networks removed."
else
  echo "[WARNING] Failed to clean up unused networks."
fi

echo "[INFO] Removing build cache..."
if docker builder prune -f >/dev/null 2>&1; then
  echo "[OK] Build cache removed."
else
  echo "[WARNING] Failed to clean up build cache."
fi

# 未使用ボリュームの削除（studysphere-backend_mysql_data は保持）
echo "[INFO] Removing unused volumes (preserving studysphere-backend_mysql_data)..."
PRESERVED="studysphere-backend_mysql_data"
REMOVED=0
ERRORS=0
while IFS= read -r vol; do
  [ -z "$vol" ] && continue
  if [ "$vol" != "$PRESERVED" ]; then
    if docker volume rm "$vol" 2>/dev/null; then
      REMOVED=$((REMOVED + 1))
    else
      ERRORS=$((ERRORS + 1))
    fi
  fi
done < <(docker volume ls -q 2>/dev/null)

if [ $REMOVED -gt 0 ]; then
  echo "[OK] Removed $REMOVED volume(s)."
else
  echo "[INFO] No volumes to remove."
fi
if [ $ERRORS -gt 0 ]; then
  echo "[WARNING] Failed to remove $ERRORS volume(s)."
fi
echo "[OK] Unused volumes removed (studysphere-backend_mysql_data preserved)."

echo ""
echo "[INFO] StudySphere Environment stopped and cleaned up."
echo "[INFO] Note: Database volume (studysphere-backend_mysql_data) is preserved to keep your data."
echo "[INFO] You can restart with: ./start-all.sh"
