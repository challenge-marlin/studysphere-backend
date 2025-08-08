FROM node:20-alpine

WORKDIR /app

# 必要なパッケージをインストール
RUN apk add --no-cache \
    netcat-openbsd \
    mysql-client \
    bash

# パッケージマネージャーのキャッシュを活用
COPY package*.json ./

# 開発環境用にnodemonも含めてインストール
RUN npm ci
RUN npm install -g nodemon

# アプリケーションコードをコピー
COPY . .

# 起動スクリプトに実行権限を付与
RUN chmod +x start.sh

# ポート5000を公開
EXPOSE 5000

# 起動スクリプトを使用
CMD ["./start.sh"] 