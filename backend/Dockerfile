FROM node:20-alpine

WORKDIR /app

# 必要なパッケージをインストール
RUN apk add --no-cache \
    netcat-openbsd \
    mysql-client \
    bash \
    dos2unix

# パッケージマネージャーのキャッシュを活用
COPY package*.json ./

# 開発環境用にnodemonも含めてインストール
RUN npm ci
RUN npm install -g nodemon

# アプリケーションコードをコピー
COPY . .

# ポート5000を公開
EXPOSE 5000

# デフォルトコマンド（docker-compose.ymlで上書きされる）
CMD ["npm", "run", "dev"] 