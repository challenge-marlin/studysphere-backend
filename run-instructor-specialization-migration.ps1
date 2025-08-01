Write-Host "指導者専門分野テーブルの追加マイグレーションを実行します..." -ForegroundColor Green
Write-Host ""

# Dockerコンテナが起動しているかチェック
$mysqlContainer = docker ps --filter "name=mysql" --format "table {{.Names}}" | Select-String "mysql"
if (-not $mysqlContainer) {
    Write-Host "MySQLコンテナが起動していません。先にdocker-compose up -dを実行してください。" -ForegroundColor Red
    Read-Host "Enterキーを押して終了"
    exit 1
}

# マイグレーション実行
Write-Host "マイグレーションファイルを実行中..." -ForegroundColor Yellow
try {
    Get-Content db/add-instructor-specializations.sql | docker exec -i studysphere-backend-mysql-1 mysql -u root -proot
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "マイグレーションが正常に完了しました。" -ForegroundColor Green
        Write-Host "指導者専門分野テーブルが追加されました。" -ForegroundColor Green
    } else {
        Write-Host "マイグレーションの実行に失敗しました。" -ForegroundColor Red
        Read-Host "Enterキーを押して終了"
        exit 1
    }
} catch {
    Write-Host "エラーが発生しました: $_" -ForegroundColor Red
    Read-Host "Enterキーを押して終了"
    exit 1
}

Read-Host "Enterキーを押して終了" 