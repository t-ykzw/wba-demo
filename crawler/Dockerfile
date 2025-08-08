FROM node:22-alpine

WORKDIR /app

# 依存関係をコピーしてインストール
COPY package*.json ./
RUN npm ci --only=production

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN npm run build

# ポート8430を公開（身元照会サーバー用）
EXPOSE 8430

# デフォルトで身元照会サーバーを起動
CMD ["npm", "run", "start:id-server"]
