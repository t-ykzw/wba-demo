import { describe, it, expect, beforeEach, vi } from 'vitest';
import Crawler from '../../crawler/crawler/index';
import { readFileSync } from 'fs';
import { join } from 'path';

// fetchをモック化
global.fetch = vi.fn();

describe('Crawler', () => {
  let crawler: Crawler;

  beforeEach(() => {
    crawler = new Crawler();
    vi.clearAllMocks();
  });

  describe('handlePayment', () => {
    it('should accept payment within limit', async () => {
      const paymentInfo = {
        required: true,
        amount: 10,
        currency: 'USD',
        description: 'Test payment',
      };

      // 支払い処理のモック
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { transactionId: 'tx_test_123' },
        }),
      });

      const result = await (crawler as any).handlePayment(paymentInfo);

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8429/payment-process',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            amount: 10,
            currency: 'USD',
            description: 'Test payment',
            crawlerId: 'my-key-id',
          }),
        })
      );
    });

    it('should reject payment above limit', async () => {
      const paymentInfo = {
        required: true,
        amount: 100,
        currency: 'USD',
        description: 'Expensive payment',
      };

      const result = await (crawler as any).handlePayment(paymentInfo);

      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should accept request without payment requirement', async () => {
      const paymentInfo = {
        required: false,
      };

      const result = await (crawler as any).handlePayment(paymentInfo);

      expect(result).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle payment processing error', async () => {
      const paymentInfo = {
        required: true,
        amount: 10,
        currency: 'USD',
        description: 'Test payment',
      };

      // 支払い処理エラーのモック
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await (crawler as any).handlePayment(paymentInfo);

      expect(result).toBe(false);
    });
  });

  describe('createSignature', () => {
    it('should create valid signature', async () => {
      const method = 'GET';
      const url = 'http://localhost:8429/test';

      const result = await (crawler as any).createSignature(method, url);

      expect(result.signature).toMatch(/^sig1=:[A-Za-z0-9+/=]+:$/);
      expect(result.signatureInput).toContain('sig1=(');
      expect(result.signatureInput).toContain('"@method"');
      expect(result.signatureInput).toContain('"@target-uri"');
      expect(result.signatureInput).toContain('keyid="my-key-id"');
    });
  });
});
