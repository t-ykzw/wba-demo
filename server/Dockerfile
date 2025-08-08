FROM node:22-alpine

WORKDIR /app

# 依存関係をコピーしてインストール
COPY package*.json ./
RUN npm ci --only=production

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN npm run build

# ポート8429を公開
EXPOSE 8429

# アプリケーションを起動
CMD ["npm", "start"]
