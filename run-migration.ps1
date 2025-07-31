Write-Host "データベースマイグレーションを実行します..." -ForegroundColor Green
Write-Host ""

# MySQLに接続してマイグレーションを実行
Get-Content db/add-phone-to-satellites.sql | mysql -u root -p

Write-Host ""
Write-Host "マイグレーションが完了しました。" -ForegroundColor Green
Read-Host "Enterキーを押して続行" 