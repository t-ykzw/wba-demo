# Web Bot Auth Demo

このプロジェクトは、Cloudflare の pay per crawl を完全ローカル環境で動作検証するためのデモアプリケーションです。

## 概要

- **コンテンツサーバー**: 支払い要求を含むコンテンツを配信するサーバー
- **クローラ**: 署名付きリクエストを送信し、支払いフローを処理するクライアント
- **身元照会サーバー**: クローラの身元情報を提供するサーバー

## セットアップ

### 1. 鍵ペアの作成

```bash
# 鍵ペアを作成
mkdir -p shared/keys
cd shared/keys
openssl genpkey -algorithm Ed25519 -out private.key
openssl pkey -in private.key -pubout -out public.key

# JWKファイルを生成
cd ../..
npx tsx ./server/tools/convert-to-jwk.ts \
  --algorithm Ed25519 \
  --public-key ./shared/keys/public.key \
  --output ./shared/keys/http-message-signatures-directory.json
```

### 2. 依存関係のインストール

```bash
# サーバー側
cd server
npm install

# クローラ側
cd ../crawler
npm install
```

### 3. Docker Composeで起動

```bash
# コンテナをビルドして起動
docker-compose up --build
```

## 使用方法

### コンテンツサーバー

- **URL**: <http://localhost:8429>
- **機能**: 各種支払いパターンのテストページを提供

#### 利用可能なパターン

1. **支払い不要ページ** (`/no-payment-required`)
   - 支払い要求のヘッダを返さないページ

2. **支払い要求ページ** (`/payment-required`)
   - 支払い要求のフローを始めるページ

3. **低価格支払いページ** (`/payment-required/low-price`)
   - 低価格（$10）の支払い要求

4. **高価格支払いページ** (`/payment-required/too-expensive`)
   - 高価格（$1000）の支払い要求

### クローラ身元照会サーバー

- **URL**: <http://localhost:8430>
- **機能**: クローラの身元情報（JWK、公開鍵）を提供

#### エンドポイント

- `/.well-known/http-message-signatures-directory.json`: JWKディレクトリ
- `/.well-known/public.key`: 公開鍵
- `/health`: ヘルスチェック

### クローラの実行

```bash
# 開発モードでクローラを実行
cd crawler
npm run dev:crawler
```

## アーキテクチャ

```
wba-demo/
├── server/                    # コンテンツサーバー
│   ├── src/index.ts          # メインサーバー
│   ├── tools/                # ユーティリティ
│   └── Dockerfile
├── crawler/                   # クローラ
│   ├── crawler/index.ts      # クローラ実装
│   ├── id-server/index.ts    # 身元照会サーバー
│   └── Dockerfile
├── shared/keys/              # 鍵ペア
│   ├── private.key
│   ├── public.key
│   └── http-message-signatures-directory.json
└── docker-compose.yml
```

## 技術スタック

- **Node.js 22**
- **TypeScript 5.x**
- **Hono** (Web Framework)
- **jose** (JWT/署名ライブラリ)
- **Docker & Docker Compose**

## 開発

### ローカル開発

```bash
# サーバー側（開発モード）
cd server
npm run dev

# クローラ側（開発モード）
cd crawler
npm run dev:crawler
npm run dev:id-server
```

### テスト

```bash
# サーバー側
cd server
npm test

# クローラ側
cd crawler
npm test
```

## 注意事項

- このデモは検証目的のみで使用してください
- 実際の本番環境では適切なセキュリティ対策が必要です
- 支払い機能は簡易実装のため、実際の決済処理は含まれていません

## 参考資料

- [Cloudflare Pay Per Crawl](https://blog.cloudflare.com/introducing-pay-per-crawl/)
- [Web Bot Auth GitHub](https://github.com/cloudflare/web-bot-auth)
