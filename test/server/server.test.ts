import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import app from '../../server/src/index';
import { importPKCS8, SignJWT } from 'jose';
import { readFileSync } from 'fs';
import { join } from 'path';

// テスト用の署名作成ヘルパー
async function createTestSignature(method: string, url: string, body?: string) {
  const privateKey = readFileSync(
    join(process.cwd(), 'shared/keys/private.key'),
    'utf8'
  );
  const keyLike = await importPKCS8(privateKey, 'Ed25519');
  const now = Math.floor(Date.now() / 1000);

  const signedData = `"@method": ${method}
"@target-uri": ${url}
"@authority": localhost:8429
"@scheme": http
"@request-target": ${new URL(url).pathname}
"created": ${now}`;

  const jwt = await new SignJWT({
    '@method': method,
    '@target-uri': url,
    '@authority': 'localhost:8429',
    '@scheme': 'http',
    '@request-target': new URL(url).pathname,
    created: now,
  })
    .setProtectedHeader({ alg: 'Ed25519', kid: 'test-key-id' })
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(keyLike);

  return {
    signature: `sig1=:${Buffer.from(jwt).toString('base64')}:`,
    signatureInput: `sig1=("@method" "@target-uri" "@authority" "@scheme" "@request-target" "created");created=${now};keyid="test-key-id"`,
  };
}

describe('Server', () => {
  let testApp: Hono;

  beforeEach(() => {
    testApp = app;
  });

  describe('GET /', () => {
    it('should return HTML with pattern links', async () => {
      const signature = await createTestSignature(
        'GET',
        'http://localhost:8429/'
      );
      const req = new Request('http://localhost:8429/', {
        headers: {
          signature: signature.signature,
          'signature-input': signature.signatureInput,
        },
      });
      const res = await testApp.request(req);

      expect(res.status).toBe(200);
      const text = await res.text();

      expect(text).toContain('Web Bot Auth Demo');
      expect(text).toContain('支払い不要ページ');
      expect(text).toContain('支払い要求ページ');
      expect(text).toContain('低価格支払いページ');
      expect(text).toContain('高価格支払いページ');
    });
  });

  describe('GET /no-payment-required', () => {
    it('should return page without payment headers', async () => {
      const signature = await createTestSignature(
        'GET',
        'http://localhost:8429/no-payment-required'
      );
      const req = new Request('http://localhost:8429/no-payment-required', {
        headers: {
          signature: signature.signature,
          'signature-input': signature.signatureInput,
        },
      });
      const res = await testApp.request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Payment-Required')).toBeNull();

      const text = await res.text();
      expect(text).toContain('支払い不要ページ');
    });
  });

  describe('GET /payment-required', () => {
    it('should return page with payment headers', async () => {
      const signature = await createTestSignature(
        'GET',
        'http://localhost:8429/payment-required'
      );
      const req = new Request('http://localhost:8429/payment-required', {
        headers: {
          signature: signature.signature,
          'signature-input': signature.signatureInput,
        },
      });
      const res = await testApp.request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Payment-Required')).toBe('true');
      expect(res.headers.get('Payment-Required-Amount')).toBe('100');
      expect(res.headers.get('Payment-Required-Currency')).toBe('USD');
      expect(res.headers.get('Payment-Required-Description')).toBe(
        'Content Access Fee'
      );

      const text = await res.text();
      expect(text).toContain('支払い要求ページ');
    });
  });

  describe('GET /payment-required/low-price', () => {
    it('should return page with low price payment headers', async () => {
      const signature = await createTestSignature(
        'GET',
        'http://localhost:8429/payment-required/low-price'
      );
      const req = new Request(
        'http://localhost:8429/payment-required/low-price',
        {
          headers: {
            signature: signature.signature,
            'signature-input': signature.signatureInput,
          },
        }
      );
      const res = await testApp.request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Payment-Required')).toBe('true');
      expect(res.headers.get('Payment-Required-Amount')).toBe('10');
      expect(res.headers.get('Payment-Required-Currency')).toBe('USD');
      expect(res.headers.get('Payment-Required-Description')).toBe(
        'Low Price Content Access Fee'
      );

      const text = await res.text();
      expect(text).toContain('低価格支払いページ');
    });
  });

  describe('GET /payment-required/too-expensive', () => {
    it('should return page with high price payment headers', async () => {
      const signature = await createTestSignature(
        'GET',
        'http://localhost:8429/payment-required/too-expensive'
      );
      const req = new Request(
        'http://localhost:8429/payment-required/too-expensive',
        {
          headers: {
            signature: signature.signature,
            'signature-input': signature.signatureInput,
          },
        }
      );
      const res = await testApp.request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Payment-Required')).toBe('true');
      expect(res.headers.get('Payment-Required-Amount')).toBe('1000');
      expect(res.headers.get('Payment-Required-Currency')).toBe('USD');
      expect(res.headers.get('Payment-Required-Description')).toBe(
        'High Price Content Access Fee'
      );

      const text = await res.text();
      expect(text).toContain('高価格支払いページ');
    });
  });

  describe('POST /payment-process', () => {
    it('should process payment successfully', async () => {
      const paymentData = {
        amount: 50,
        currency: 'USD',
        description: 'Test payment',
        crawlerId: 'test-crawler',
      };

      const signature = await createTestSignature(
        'POST',
        'http://localhost:8429/payment-process'
      );
      const req = new Request('http://localhost:8429/payment-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          signature: signature.signature,
          'signature-input': signature.signatureInput,
        },
        body: JSON.stringify(paymentData),
      });

      const res = await testApp.request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Payment processed successfully');
    });

    it('should handle invalid JSON data', async () => {
      const signature = await createTestSignature(
        'POST',
        'http://localhost:8429/payment-process'
      );
      const req = new Request('http://localhost:8429/payment-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          signature: signature.signature,
          'signature-input': signature.signatureInput,
        },
        body: 'invalid json',
      });

      const res = await testApp.request(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });
});
