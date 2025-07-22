#!/bin/bash

# データベース初期化スクリプト
# 使用方法:
# ./scripts/init-db.sh          # データベースを初期化（既存データを保持）
# ./scripts/init-db.sh --reset  # データベースをリセット（既存データを削除）

set -e

echo "=== カリキュラムポータル データベース初期化スクリプト ==="

# 引数チェック
RESET_DB=false
if [ "$1" = "--reset" ]; then
    RESET_DB=true
    echo "⚠️  警告: 既存のデータベースデータを削除します"
    read -p "続行しますか？ (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "キャンセルしました"
        exit 1
    fi
fi

# Docker Composeが実行中かチェック
if ! docker-compose ps | grep -q "mysql_db.*Up"; then
    echo "❌ MySQLコンテナが起動していません"
    echo "先に 'docker-compose up -d' を実行してください"
    exit 1
fi

if [ "$RESET_DB" = true ]; then
    echo "🔄 データベースをリセットしています..."
    
    # コンテナを停止
    docker-compose stop db
    
    # ボリュームを削除
    docker-compose down -v
    
    # コンテナを再起動（init.sqlが実行される）
    docker-compose up -d db
    
    echo "✅ データベースがリセットされました"
else
    echo "🔄 データベースを初期化しています..."
    
    # 既存のデータベースにinit.sqlを実行
    docker-compose exec -T db mysql -u root -pshinomoto926! curriculum-portal < db/init.sql
    
    echo "✅ データベースが初期化されました"
fi

echo "🎉 完了しました！"
echo ""
echo "データベース接続情報:"
echo "  Host: localhost"
echo "  Port: 3307"
echo "  Database: curriculum-portal"
echo "  Username: root"
echo "  Password: shinomoto926!" 