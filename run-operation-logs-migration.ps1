Write-Host "操作ログテーブルの作成を開始します..." -ForegroundColor Green

# Dockerコンテナ内でSQLファイルを実行
Get-Content db/create-operation-logs-table.sql | docker-compose exec -T db mysql -u root -pshinomoto926! curriculum-portal

if ($LASTEXITCODE -eq 0) {
    Write-Host "操作ログテーブルの作成が完了しました。" -ForegroundColor Green
} else {
    Write-Host "操作ログテーブルの作成に失敗しました。" -ForegroundColor Red
    Read-Host "Enterキーを押して終了"
} 