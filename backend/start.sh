#!/bin/bash

# データベース接続を待機する関数
wait_for_db() {
    echo "Waiting for database to be ready..."
    while ! mysql --skip-ssl -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" --silent; do
        echo "Database is not ready yet. Waiting..."
        sleep 2
    done
    echo "Database is ready!"
}

# データベース接続を待機
wait_for_db

# アプリケーションを起動
echo "Starting application..."
node index.js
