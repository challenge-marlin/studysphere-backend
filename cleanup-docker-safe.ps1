# Docker 安全クリーンアップスクリプト（データ保持版）
# 使用方法: .\cleanup-docker-safe.ps1

Write-Host "=== Docker 安全クリーンアップ開始（データ保持） ===" -ForegroundColor Green

# 現在のコンテナを停止
Write-Host "1. 現在のコンテナを停止中..." -ForegroundColor Yellow
docker-compose down

# ビルドキャッシュのみを削除（データは保持）
Write-Host "2. ビルドキャッシュを削除中..." -ForegroundColor Yellow
docker builder prune -f

# 未使用のイメージを削除
Write-Host "3. 未使用のイメージを削除中..." -ForegroundColor Yellow
docker image prune -f

# 未使用のネットワークを削除
Write-Host "4. 未使用のネットワークを削除中..." -ForegroundColor Yellow
docker network prune -f

# 停止中のコンテナを削除
Write-Host "5. 停止中のコンテナを削除中..." -ForegroundColor Yellow
docker container prune -f

Write-Host "=== 安全クリーンアップ完了 ===" -ForegroundColor Green

# クリーンアップ後の状況を表示
Write-Host "`n=== クリーンアップ後の状況 ===" -ForegroundColor Cyan
docker system df

Write-Host "`n=== 残っているボリューム（データ保持） ===" -ForegroundColor Cyan
docker volume ls

Write-Host "`n=== コンテナを再起動しますか？ (y/n) ===" -ForegroundColor Yellow
$response = Read-Host
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "コンテナを再起動中..." -ForegroundColor Green
    docker-compose up -d
} 