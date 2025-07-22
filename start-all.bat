@echo off
echo 🚀 AI-Skill-Curriculum バックエンドシステムを起動しています...

REM Docker Composeでバックエンドサービスを起動
docker-compose up -d

echo ✅ バックエンドサービスが起動しました！
echo.
echo 🔧 バックエンドAPI: http://localhost:5000
echo 🗄️  データベース: localhost:3307
echo.
echo 📊 ログを確認するには: docker-compose logs -f
echo 🛑 停止するには: docker-compose down
echo.
echo 💡 フロントエンドを起動するには:
echo    cd ../front/reactStudySphereMockup ^&^& docker-compose up -d
pause 