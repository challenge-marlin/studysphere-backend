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

# package-lock.jsonの存在確認とnpm ciの実行
# npm ciが失敗する場合は詳細なエラーを表示してからnpm installにフォールバック
RUN if [ -f package-lock.json ]; then \
      echo "package-lock.json found, running npm ci..." && \
      npm ci || (echo "npm ci failed with exit code $?, trying npm install..." && npm install); \
    else \
      echo "package-lock.json not found, running npm install..." && \
      npm install; \
    fi

# 開発環境用にnodemonも含めてインストール
RUN npm install -g nodemon

# アプリケーションコードをコピー
COPY . .

# ポート5000を公開
EXPOSE 5000

# デフォルトコマンド（docker-compose.ymlで上書きされる）
CMD ["npm", "run", "dev"] 