
# Web Bot Auth ローカル環境構築

この文書は、Cloudflare の pay per crawl を完全ローカル環境で動作検証をするための作るための設計書です

cf. [pay per crawl](https://blog.cloudflare.com/introducing-pay-per-crawl/)

## 目的

- Pay per crawl に対応したクローラの開発を進めるための検証環境を作る
- web-bot-auth に対応したサーバー側実装とクライアント（クローラ）実装を用意し，擬似的な支払いフローまで含めた種々のフローを確認できるようにする

---

## ディレクトリ構成

```plain
wba-demo/
├── crawler/                         # 署名付きリクエストを送信するクライアント
│   ├── Dockerfile
│   ├── id-server/
│   ├── crawler/
│   ├── test/
│   └── package.json
├── server/                         # 署名を検証する TypeScript サーバー
│   ├── Dockerfile
│   ├── src/
│   ├── test/
│   ├── tools/
│   │   └── convert-to-jwk.ts       # 公開鍵を JWK 形式に変換するユーティリティ
│   └── package.json
├── shared/keys/                    # Ed25519 鍵と /.well-known ディレクトリ
├── external/web-bot-auth/          # web-bot-auth 関連パッケージ
├── docs/                           # documents
│   └── setup-project.md            # this file
└── README.md                       # この手順書
```

### 言語などの設定

- docker
- nodejs 22
  - typescript 4.x
  - eslint 8, prettier
  - vitest
  - hono
- openssl

---

## 🔑 STEP 1: 鍵ペアの作成

```bash
mkdir -p shared/keys
cd shared/keys
openssl genpkey -algorithm Ed25519 -out private.key
openssl pkey -in private.key -pubout -out public.key
```

### JWK 形式への変換ツール

次のコマンドで JWK ファイルを生成します：

```bash
cd wba-demo/
npx tsx ./server/tools/convert-to-jwk.ts \
  --algorithm Ed25519 \
  --public-key ./shared/keys/public.key \
  --output ./shared/keys/http-message-signatures-directory.json
```

#### `server/tools/convert-to-jwk.ts`

```ts
import { readFileSync, writeFileSync } from 'fs';
import { argv } from 'process';
import { importSPKI } from 'jose/key/import';
import { fromKeyLike } from 'jose/jwk/from_key_like';

async function main() {
  const algIndex = argv.indexOf('--algorithm');
  const pubIndex = argv.indexOf('--public-key');
  const outIndex = argv.indexOf('--output');

  if (algIndex === -1 || pubIndex === -1 || outIndex === -1) {
    console.error('Usage: --algorithm Ed25519 --public-key <path> --output <path>');
    process.exit(1);
  }

  const algorithm = argv[algIndex + 1];
  const publicKeyPath = argv[pubIndex + 1];
  const outputPath = argv[outIndex + 1];

  const pem = readFileSync(publicKeyPath, 'utf8');
  const keyLike = await importSPKI(pem, algorithm);
  const jwk = await fromKeyLike(keyLike);
  jwk.kid = 'my-key-id';

  const output = { keys: [jwk] };
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`✅ Wrote JWK to ${outputPath}`);
}

(async () { await main();} )();
```

---

## STEP 2: コンテンツサーバー実装（TypeScript）

コンテンツ配信業者のエミュレーションをするためのモジュール

- server/ 以下に ts で実装する
- logger を使い構造化ログとして記録する
  - console.log 禁止
- web app framework としては hono を想定
  - css などの見た目は考えなくて良い
- `/` では，各種パターンへのリンクの一覧とその説明を表示
- 各パターンごとのページ（URL）を用意する
  - `/no-payment-required`
    - 支払い要求のヘッダを返さないページ
  - `/payment-required`
    - 支払い要求のフローを始めるページ
  - `/payment-required/low-price`
    - 支払い要求が来てるが，はじめから払える金額が要求されるページ
  - `/payment-required/too-expensive`
    - 支払い要求が来てるが，払えないので決裂するページ
- この他想定可能なパターンがあれば随時増やす
- docker で 8429 ポートで動かすことにする

---

## STEP 3: クローラ実装（TypeScript）

クローラ事業者のエミュレーションをするためのモジュール

- crawler/crawler 以下に ts で実装する
- logger を使い構造化ログとして記録する
  - console.log 禁止
- まずは サーバーの `/` にアクセスして，想定フローのURLとその説明を入手する
- 想定フローのそれぞれの url にアクセスして，応答に沿った返答をして最終結果を得る
- 動作中のリクエストと，サーバーからのレスポンスを，ログに残す
-

### クローラ身元照会サーバの実装

クローラの身元の照会を受けるためのモジュール

- crawler/id-server 以下に ts で実装する
- web app framework としては hono を想定
- `shared/keys/` においた情報を返すだけ
- docker で 8430 ポートで動かすことにする
  - クローラからのリクエストに対してサーバーはこの身元照会サーバにアクセスできる必要があるので同一ネットワーク上で動かす

---

## STEP 4: `docker-compose.yml`

docker-compose.yml を用意して，コンテンツサーバとクローラ身元照会サーバが起動するようにする

## STEP 5: readme.md

README.md を更新して，使い方その他を書く

---

## 補足

- 検証ロジックは [web-bot-auth GitHub](https://github.com/cloudflare/web-bot-auth) を参照
  - 内部でパッケージとして `http-message-sig` を使うことになっているが npm として公開されてないので，  web-bot-auth を `external/web-bot-auth` ディレクトリに clone しておいて， `packages/http-message-sig` を活用する
- 秘密鍵: PEM 形式（Ed25519）
- 公開鍵: JWK（.well-known で提供）

---
