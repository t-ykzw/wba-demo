import { readFileSync } from 'fs';
import { join } from 'path';
import { importPKCS8, SignJWT } from 'jose';
import fetch from 'node-fetch';

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

interface Pattern {
  name: string;
  url: string;
  description: string;
}

interface PaymentInfo {
  required: boolean;
  amount?: number;
  currency?: string;
  description?: string;
}

class Crawler {
  private privateKey: string;
  private keyId: string;
  private serverUrl: string;

  constructor() {
    // 環境変数から鍵ファイルパスを取得、デフォルトはプロジェクトルート
    const keysDir = process.env.KEYS_DIR || join(process.cwd(), 'shared/keys');
    this.privateKey = readFileSync(join(keysDir, 'private.key'), 'utf8');
    this.keyId = 'my-key-id';
    this.serverUrl = 'http://localhost:8429';

    log.info('クローラ初期化完了', {
      keysDir,
      keyId: this.keyId,
      serverUrl: this.serverUrl,
    });
  }

  private async createSignature(
    method: string,
    url: string,
    body?: string
  ): Promise<{ signature: string; signatureInput: string }> {
    const keyLike = await importPKCS8(this.privateKey, 'Ed25519');

    const now = Math.floor(Date.now() / 1000);
    const urlObj = new URL(url);

    // 署名データを構築
    const signedData = `"@method": ${method.toUpperCase()}
"@target-uri": ${url}
"@authority": ${urlObj.host}
"@scheme": ${urlObj.protocol.slice(0, -1)}
"@request-target": ${urlObj.pathname}${urlObj.search}
"created": ${now}`;

    // JWTとして署名を生成
    const jwt = await new SignJWT({
      '@method': method.toUpperCase(),
      '@target-uri': url,
      '@authority': urlObj.host,
      '@scheme': urlObj.protocol.slice(0, -1),
      '@request-target': `${urlObj.pathname}${urlObj.search}`,
      created: now,
    })
      .setProtectedHeader({ alg: 'Ed25519', kid: this.keyId })
      .setIssuedAt(now)
      .setExpirationTime(now + 300) // 5分後
      .sign(keyLike);

    // Signature-Inputヘッダーを構築
    const signatureInput = `sig1=("@method" "@target-uri" "@authority" "@scheme" "@request-target" "created");created=${now};keyid="${this.keyId}"`;

    return {
      signature: `sig1=:${Buffer.from(jwt).toString('base64')}:`,
      signatureInput,
    };
  }

  private async makeRequest(
    url: string,
    method: string = 'GET',
    body?: string
  ): Promise<{ response: any; paymentInfo: PaymentInfo }> {
    const { signature, signatureInput } = await this.createSignature(
      method,
      url,
      body
    );

    const headers: Record<string, string> = {
      Signature: signature,
      'Signature-Input': signatureInput,
      'Content-Type': 'application/json',
    };

    log.info('リクエスト送信', {
      method,
      url,
      signature: signature.substring(0, 50) + '...',
    });

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    const responseText = await response.text();
    log.info('レスポンス受信', {
      status: response.status,
      statusText: response.statusText,
      bodyPreview: responseText.substring(0, 200),
    });

    // 支払い情報を解析
    const paymentInfo: PaymentInfo = {
      required: response.headers.get('Payment-Required') === 'true',
      amount: response.headers.get('Payment-Required-Amount')
        ? parseInt(response.headers.get('Payment-Required-Amount')!)
        : undefined,
      currency: response.headers.get('Payment-Required-Currency') || undefined,
      description:
        response.headers.get('Payment-Required-Description') || undefined,
    };

    if (paymentInfo.required) {
      log.info('支払い要求検出', {
        amount: paymentInfo.amount,
        currency: paymentInfo.currency,
        description: paymentInfo.description,
      });
    }

    return { response, paymentInfo };
  }

  private async handlePayment(paymentInfo: PaymentInfo): Promise<boolean> {
    if (!paymentInfo.required) {
      return true;
    }

    // 支払いロジック（簡易版）
    const maxPayment = 50; // 最大支払い額
    const canPay = paymentInfo.amount && paymentInfo.amount <= maxPayment;

    if (canPay) {
      log.info('支払い実行開始', {
        amount: paymentInfo.amount,
        currency: paymentInfo.currency,
      });

      // 支払い処理を実行
      try {
        const paymentResponse = await fetch(
          `${this.serverUrl}/payment-process`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Signature: (
                await this.createSignature(
                  'POST',
                  `${this.serverUrl}/payment-process`
                )
              ).signature,
              'Signature-Input': (
                await this.createSignature(
                  'POST',
                  `${this.serverUrl}/payment-process`
                )
              ).signatureInput,
            },
            body: JSON.stringify({
              amount: paymentInfo.amount,
              currency: paymentInfo.currency,
              description: paymentInfo.description,
              crawlerId: this.keyId,
            }),
          }
        );

        if (paymentResponse.ok) {
          const paymentResult = (await paymentResponse.json()) as any;
          log.info('支払い成功', {
            transactionId: paymentResult.data?.transactionId || 'unknown',
          });
          return true;
        } else {
          log.error('支払い処理失敗', { status: paymentResponse.status });
          return false;
        }
      } catch (error) {
        log.error('支払い処理エラー', error);
        return false;
      }
    } else {
      log.info('支払い拒否（正常動作）', {
        amount: paymentInfo.amount,
        currency: paymentInfo.currency,
        maxPayment,
        reason: '金額が上限を超えているため',
      });
      return false;
    }
  }

  async crawlPatterns(): Promise<void> {
    log.info('クローラ開始');

    try {
      // 1. サーバーのルートページにアクセスしてパターンを取得
      const { response: rootResponse } = await this.makeRequest(
        `${this.serverUrl}/`
      );

      if (!rootResponse.ok) {
        throw new Error(`ルートページの取得に失敗: ${rootResponse.status}`);
      }

      log.info('利用可能なパターンを取得完了');

      // 2. 各パターンをテスト
      const patterns: Pattern[] = [
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

      for (const pattern of patterns) {
        log.info('パターンテスト開始', {
          name: pattern.name,
          description: pattern.description,
        });

        const { response, paymentInfo } = await this.makeRequest(
          `${this.serverUrl}${pattern.url}`
        );

        if (response.ok) {
          const canAccess = await this.handlePayment(paymentInfo);

          if (canAccess) {
            log.info('アクセス成功', { pattern: pattern.name });
          } else {
            log.info('アクセス拒否（正常動作）', {
              pattern: pattern.name,
              reason: '支払い拒否',
            });
          }
        } else {
          log.error('リクエスト失敗', {
            pattern: pattern.name,
            status: response.status,
          });
        }
      }

      log.info('すべてのパターンテスト完了');
    } catch (error) {
      log.error('クローラエラー', error);
    }
  }
}

// メイン実行
async function main() {
  const crawler = new Crawler();
  await crawler.crawlPatterns();
}

if (require.main === module) {
  main().catch(error => log.error('メイン処理エラー', error));
}

export default Crawler;
