# データベースマイグレーション実行スクリプト
Write-Host "データベースマイグレーションを開始します..." -ForegroundColor Green

# 現在のディレクトリを確認
Write-Host "現在のディレクトリ: $(Get-Location)" -ForegroundColor Yellow

# SQLファイルの存在確認
$sqlFile = "db/create-courses-lessons-tables.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "エラー: SQLファイルが見つかりません: $sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "SQLファイルを確認しました: $sqlFile" -ForegroundColor Green

# Dockerコンテナの状態確認
Write-Host "Dockerコンテナの状態を確認しています..." -ForegroundColor Yellow
$containerStatus = docker ps --filter "name=studysphere-backend-db-1" --format "table {{.Names}}\t{{.Status}}"
Write-Host $containerStatus

# データベースマイグレーション実行
Write-Host "データベースマイグレーションを実行しています..." -ForegroundColor Yellow
try {
    Get-Content $sqlFile | docker exec -i studysphere-backend-db-1 mysql -u root -ppassword myapp
    Write-Host "データベースマイグレーションが正常に完了しました！" -ForegroundColor Green
} catch {
    Write-Host "エラー: データベースマイグレーションに失敗しました" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "マイグレーション完了！" -ForegroundColor Green 