@echo off
echo === Docker クリーンアップ開始 ===

REM 未使用のボリュームを削除
echo 1. 未使用のボリュームを削除中...
docker volume prune -f

REM 未使用のネットワークを削除
echo 2. 未使用のネットワークを削除中...
docker network prune -f

REM 未使用のイメージを削除
echo 3. 未使用のイメージを削除中...
docker image prune -f

REM ビルドキャッシュを削除
echo 4. ビルドキャッシュを削除中...
docker builder prune -f

REM 停止中のコンテナを削除
echo 5. 停止中のコンテナを削除中...
docker container prune -f

echo === クリーンアップ完了 ===

REM クリーンアップ後の状況を表示
echo.
echo === クリーンアップ後の状況 ===
docker system df

echo.
echo === 残っているボリューム ===
docker volume ls

pause 