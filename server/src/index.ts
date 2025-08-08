import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { AuthVerifier, RequestLike } from './auth-verifier';

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
  warn: (message: string, data?: any) => {
    console.log(
      JSON.stringify({
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        ...data,
      })
    );
  },
};

const app = new Hono();
const authVerifier = new AuthVerifier();

// ミドルウェア
app.use('*', logger());
app.use('*', cors());

// 署名検証ミドルウェア
app.use('*', async (c, next) => {
  try {
    const request: RequestLike = {
      method: c.req.method,
      url: c.req.url,
      headers: Object.fromEntries(c.req.raw.headers.entries()),
    };

    const verificationResult = await authVerifier.verifyRequest(request);

    if (!verificationResult.isValid) {
      log.error('署名検証失敗', { error: verificationResult.error });
      return c.json(
        {
          error: 'Signature verification failed',
          details: verificationResult.error,
        },
        401
      );
    }

    log.info('署名検証成功', {
      keyId: verificationResult.keyId,
      algorithm: verificationResult.algorithm,
    });

    // 検証結果をヘッダーに保存（ログ用）
    c.header('X-Verification-KeyId', verificationResult.keyId || 'unknown');
    c.header(
      'X-Verification-Algorithm',
      verificationResult.algorithm || 'unknown'
    );
  } catch (error) {
    log.error('署名検証エラー', error);
    return c.json({ error: 'Signature verification error' }, 500);
  }

  await next();
});

// ルートページ - 各種パターンへのリンク一覧
app.get('/', c => {
  const patterns = [
    {
      name: '支払い不要ページ',
      url: '/no-payment-required',
      description: '支払い要求のヘッダを返さないページ',
    },
    {
      name: '支払い要求ページ',
      url: '/payment-required',
      description: '支払い要求のフローを始めるページ',
    },
    {
      name: '低価格支払いページ',
      url: '/payment-required/low-price',
      description:
        '支払い要求が来てるが、はじめから払える金額が要求されるページ',
    },
    {
      name: '高価格支払いページ',
      url: '/payment-required/too-expensive',
      description: '支払い要求が来てるが、払えないので決裂するページ',
    },
  ];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Web Bot Auth Demo - コンテンツサーバー</title>
      <meta charset="utf-8">
    </head>
    <body>
      <h1>Web Bot Auth Demo - コンテンツサーバー</h1>
      <p>以下のパターンをテストできます：</p>
      <ul>
        ${patterns
          .map(
            pattern => `
          <li>
            <a href="${pattern.url}">${pattern.name}</a>
            <br>
            <small>${pattern.description}</small>
          </li>
        `
          )
          .join('')}
      </ul>
    </body>
    </html>
  `;

  return c.html(html);
});

// 支払い不要ページ
app.get('/no-payment-required', c => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>支払い不要ページ</title>
      <meta charset="utf-8">
    </head>
    <body>
      <h1>支払い不要ページ</h1>
      <p>このページは支払い要求のヘッダを返しません。</p>
      <p>クローラは通常通りコンテンツを取得できます。</p>
      <a href="/">← トップに戻る</a>
    </body>
    </html>
  `);
});

// 支払い要求ページ
app.get('/payment-required', c => {
  // 支払い要求のヘッダを設定
  c.header('Payment-Required', 'true');
  c.header('Payment-Required-Amount', '100');
  c.header('Payment-Required-Currency', 'USD');
  c.header('Payment-Required-Description', 'Content Access Fee');

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>支払い要求ページ</title>
      <meta charset="utf-8">
    </head>
    <body>
      <h1>支払い要求ページ</h1>
      <p>このページは支払い要求のヘッダを返します。</p>
      <p>クローラは支払いフローを開始する必要があります。</p>
      <p><strong>Signature Verified</strong>: keyId=${c.req.header('X-Verification-KeyId') || 'unknown'}</p>
      <a href="/">← トップに戻る</a>
    </body>
    </html>
  `);
});

// 低価格支払いページ
app.get('/payment-required/low-price', c => {
  // 低価格の支払い要求
  c.header('Payment-Required', 'true');
  c.header('Payment-Required-Amount', '10');
  c.header('Payment-Required-Currency', 'USD');
  c.header('Payment-Required-Description', 'Low Price Content Access Fee');

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>低価格支払いページ</title>
      <meta charset="utf-8">
    </head>
    <body>
      <h1>低価格支払いページ</h1>
      <p>このページは低価格（$10）の支払い要求を返します。</p>
      <p>クローラは支払いを実行してコンテンツにアクセスできます。</p>
      <p><strong>Signature Verified</strong>: keyId=${c.req.header('X-Verification-KeyId') || 'unknown'}</p>
      <a href="/">← トップに戻る</a>
    </body>
    </html>
  `);
});

// 高価格支払いページ
app.get('/payment-required/too-expensive', c => {
  // 高価格の支払い要求
  c.header('Payment-Required', 'true');
  c.header('Payment-Required-Amount', '1000');
  c.header('Payment-Required-Currency', 'USD');
  c.header('Payment-Required-Description', 'High Price Content Access Fee');

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>高価格支払いページ</title>
      <meta charset="utf-8">
    </head>
    <body>
      <h1>高価格支払いページ</h1>
      <p>このページは高価格（$1000）の支払い要求を返します。</p>
      <p>クローラは支払いを拒否してコンテンツにアクセスできません。</p>
      <p><strong>Signature Verified</strong>: keyId=${c.req.header('X-Verification-KeyId') || 'unknown'}</p>
      <a href="/">← トップに戻る</a>
    </body>
    </html>
  `);
});

// 支払い処理エンドポイント
app.post('/payment-process', async c => {
  try {
    const body = await c.req.json();
    const { amount, currency, description, crawlerId } = body;

    log.info('支払い処理開始', { amount, currency, description, crawlerId });

    // 簡易的な支払い処理（実際の決済は行わない）
    const paymentResult = {
      success: true,
      transactionId: `tx_${Date.now()}`,
      amount,
      currency,
      description,
      timestamp: new Date().toISOString(),
    };

    log.info('支払い成功', { transactionId: paymentResult.transactionId });

    return c.json({
      success: true,
      message: 'Payment processed successfully',
      data: paymentResult,
    });
  } catch (error) {
    log.error('支払い処理エラー', error);
    return c.json(
      {
        success: false,
        error: 'Payment processing failed',
      },
      500
    );
  }
});

export default app;

import { serve } from '@hono/node-server';

// サーバー起動設定
const port = process.env.PORT || 8429;

log.info('サーバー起動開始', { port });
serve({
  fetch: app.fetch,
  port: parseInt(port.toString()),
});
