# Docker クリーンアップスクリプト
# 使用方法: .\cleanup-docker.ps1

Write-Host "=== Docker クリーンアップ開始 ===" -ForegroundColor Green

# 1. 未使用のボリュームを削除
Write-Host "1. 未使用のボリュームを削除中..." -ForegroundColor Yellow
docker volume prune -f

# 2. 未使用のネットワークを削除
Write-Host "2. 未使用のネットワークを削除中..." -ForegroundColor Yellow
docker network prune -f

# 3. 未使用のイメージを削除
Write-Host "3. 未使用のイメージを削除中..." -ForegroundColor Yellow
docker image prune -f

# 4. ビルドキャッシュを削除
Write-Host "4. ビルドキャッシュを削除中..." -ForegroundColor Yellow
docker builder prune -f

# 5. 停止中のコンテナを削除
Write-Host "5. 停止中のコンテナを削除中..." -ForegroundColor Yellow
docker container prune -f

# 6. システム全体のクリーンアップ（オプション）
Write-Host "6. システム全体のクリーンアップ中..." -ForegroundColor Yellow
docker system prune -f

Write-Host "=== クリーンアップ完了 ===" -ForegroundColor Green

# クリーンアップ後の状況を表示
Write-Host "`n=== クリーンアップ後の状況 ===" -ForegroundColor Cyan
docker system df

Write-Host "`n=== 残っているボリューム ===" -ForegroundColor Cyan
docker volume ls 