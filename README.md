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
# 依存関係をインストール
npm install
```

### 3. 環境変数の設定（オプション）

鍵ファイルのパスをカスタマイズする場合：

```bash
# 環境変数で鍵ファイルディレクトリを指定
export KEYS_DIR=/path/to/your/keys

# または、実行時に指定
KEYS_DIR=/path/to/your/keys npm run dev:server
```

デフォルトでは `./shared/keys` が使用されます。

### 4. Docker Composeで起動

```bash
# コンテナをビルドして起動
docker-compose up --build
```

## 使用方法

### 開発モードでの起動

```bash
# サーバー側（開発モード）
npm run dev:server

# 身元照会サーバー（開発モード）
npm run dev:id-server

# クローラ（開発モード）
npm run dev:crawler
```

### コンテンツサーバー

- **URL**: `http://localhost:8429`
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

- **URL**: `http://localhost:8430`
- **機能**: クローラの身元情報（JWK、公開鍵）を提供

#### エンドポイント

- `/.well-known/http-message-signatures-directory.json`: JWKディレクトリ
- `/.well-known/public.key`: 公開鍵
- `/health`: ヘルスチェック

## アーキテクチャ

```plain
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

### コード整形

```bash
# コードを整形
npm run format

# 整形チェック
npm run format:check
```

### ビルド

```bash
# すべてをビルド
npm run build
```

### テスト

```bash
# すべてのテスト
npm test

# 個別テスト
npm run test:server
npm run test:crawler
```

## 注意事項

- このデモは検証目的のみで使用してください
- 実際の本番環境では適切なセキュリティ対策が必要です
- 支払い機能は簡易実装のため、実際の決済処理は含まれていません

## 参考資料

- [Cloudflare Pay Per Crawl](https://blog.cloudflare.com/introducing-pay-per-crawl/)
- [Web Bot Auth GitHub](https://github.com/cloudflare/web-bot-auth)
