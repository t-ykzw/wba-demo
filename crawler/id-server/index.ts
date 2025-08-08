import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { readFileSync } from 'fs';
import { join } from 'path';

// 構造化ログ用のlogger
const log = {
  info: (message: string, data?: any) => {
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...data,
      })
    );
  },
  error: (message: string, error?: any) => {
    console.log(
      JSON.stringify({
        level: 'error',
        message,
        timestamp: new Date().toISOString(),
        error: error?.message || error,
      })
    );
  },
};

const app = new Hono();

// ミドルウェア
app.use('*', logger());
app.use('*', cors());

// JWKディレクトリを提供
app.get('/.well-known/http-message-signatures-directory.json', c => {
  try {
    const jwkPath = join(
      process.cwd(),
      'shared/keys/http-message-signatures-directory.json'
    );
    const jwkData = readFileSync(jwkPath, 'utf8');
    c.header('Content-Type', 'application/json');
    return c.body(jwkData);
  } catch (error) {
    log.error('JWKファイルの読み込みエラー', error);
    return c.json({ error: 'JWK file not found' }, 500);
  }
});

// 公開鍵を提供
app.get('/.well-known/public.key', c => {
  try {
    const publicKeyPath = join(process.cwd(), 'shared/keys/public.key');
    const publicKey = readFileSync(publicKeyPath, 'utf8');
    c.header('Content-Type', 'application/x-pem-file');
    return c.body(publicKey);
  } catch (error) {
    log.error('公開鍵ファイルの読み込みエラー', error);
    return c.json({ error: 'Public key file not found' }, 500);
  }
});

// ヘルスチェック
app.get('/health', c => {
  return c.json({ status: 'ok', service: 'crawler-id-server' });
});

export default app;

import { serve } from '@hono/node-server';

// サーバー起動設定
const port = process.env.PORT || 8430;

log.info('身元照会サーバー起動開始', { port });
serve({
  fetch: app.fetch,
  port: parseInt(port.toString()),
});
