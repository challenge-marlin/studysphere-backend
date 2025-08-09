Param()

$ErrorActionPreference = 'Stop'

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " StudySphere Backend 強制リビルド（データ保持）" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Docker 起動確認
try {
  docker info *> $null
} catch {
  Write-Host "[ERROR] Docker Desktop を起動してください。" -ForegroundColor Red
  pause
  exit 1
}

# 実行場所確認（studysphere-backend）
if (-not (Test-Path './docker-compose.yml')) {
  Write-Host "[ERROR] このスクリプトは studysphere-backend フォルダ内で実行してください。" -ForegroundColor Red
  pause
  exit 1
}

# .env のBOM除去（存在する場合のみ）
if (Test-Path './.env') {
  Write-Host "[INFO] .env の BOM を除去します..." -ForegroundColor Yellow
  try {
    $content = Get-Content -Raw -Path './.env'
    # UTF8 (No BOM) で書き戻し
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path './.env'), $content, $utf8NoBom)
  } catch {
    Write-Host "[WARNING] .env のBOM除去に失敗しました: $_" -ForegroundColor Yellow
  }
}

Write-Host "[INFO] Backend コンテナを停止しています..." -ForegroundColor Yellow
docker compose stop backend *> $null

Write-Host "[INFO] Backend コンテナを削除しています（データは削除しません）..." -ForegroundColor Yellow
docker compose rm -f backend *> $null

Write-Host "[INFO] Backend イメージを --no-cache で強制ビルドしています..." -ForegroundColor Yellow
docker compose build backend --no-cache

Write-Host "[INFO] DB と Backend を再起動しています..." -ForegroundColor Yellow
docker compose up -d db backend

Write-Host "[INFO] Backend のヘルスチェックを実施します..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
  curl -f http://localhost:5000/health *> $null
} catch {
  Write-Host "[WARNING] ヘルスチェックに失敗しました。ログを表示します。" -ForegroundColor Yellow
  docker compose logs --no-color --tail 200 backend
  Write-Host "[HINT] 追跡表示: docker compose logs -f backend" -ForegroundColor DarkGray
  pause
  exit 1
}

Write-Host "`n[SUCCESS] 強制リビルドと再起動が完了しました（データ保持）。" -ForegroundColor Green
Write-Host "[INFO] Backend: http://localhost:5000"
Write-Host "[INFO] ログの追跡表示: docker compose logs -f backend"
pause


