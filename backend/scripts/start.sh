#!/bin/sh

# データベースの準備ができるまで待機
echo "Waiting for database to be ready..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 1
done
echo "Database is ready!"

# アプリケーションを起動
echo "Starting application..."
npm run dev 