FROM node:20-alpine

WORKDIR /app

# netcatをインストール（データベース接続確認用）
RUN apk add --no-cache netcat-openbsd

# パッケージマネージャーのキャッシュを活用
COPY package*.json ./

# 開発環境用にnodemonも含めてインストール
RUN npm ci
RUN npm install -g nodemon

# アプリケーションコードをコピー
COPY . .

# ポート5000を公開
EXPOSE 5000

# 起動スクリプトで起動
CMD ["npm", "run", "dev"] 