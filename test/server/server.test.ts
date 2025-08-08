import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import app from '../../../server/src/index';

describe('Server', () => {
  let testApp: Hono;

  beforeEach(() => {
    testApp = app;
  });

  describe('GET /', () => {
    it('should return HTML with pattern links', async () => {
      const req = new Request('http://localhost:8429/');
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
      const req = new Request('http://localhost:8429/no-payment-required');
      const res = await testApp.request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Payment-Required')).toBeNull();
      
      const text = await res.text();
      expect(text).toContain('支払い不要ページ');
    });
  });

  describe('GET /payment-required', () => {
    it('should return page with payment headers', async () => {
      const req = new Request('http://localhost:8429/payment-required');
      const res = await testApp.request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Payment-Required')).toBe('true');
      expect(res.headers.get('Payment-Required-Amount')).toBe('100');
      expect(res.headers.get('Payment-Required-Currency')).toBe('USD');
      expect(res.headers.get('Payment-Required-Description')).toBe('Content Access Fee');
      
      const text = await res.text();
      expect(text).toContain('支払い要求ページ');
    });
  });

  describe('GET /payment-required/low-price', () => {
    it('should return page with low price payment headers', async () => {
      const req = new Request('http://localhost:8429/payment-required/low-price');
      const res = await testApp.request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Payment-Required')).toBe('true');
      expect(res.headers.get('Payment-Required-Amount')).toBe('10');
      expect(res.headers.get('Payment-Required-Currency')).toBe('USD');
      expect(res.headers.get('Payment-Required-Description')).toBe('Low Price Content Access Fee');
      
      const text = await res.text();
      expect(text).toContain('低価格支払いページ');
    });
  });

  describe('GET /payment-required/too-expensive', () => {
    it('should return page with high price payment headers', async () => {
      const req = new Request('http://localhost:8429/payment-required/too-expensive');
      const res = await testApp.request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Payment-Required')).toBe('true');
      expect(res.headers.get('Payment-Required-Amount')).toBe('1000');
      expect(res.headers.get('Payment-Required-Currency')).toBe('USD');
      expect(res.headers.get('Payment-Required-Description')).toBe('High Price Content Access Fee');
      
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

      const req = new Request('http://localhost:8429/payment-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const res = await testApp.request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      
      expect(data.success).toBe(true);
      expect(data.message).toBe('Payment processed successfully');
      expect(data.data).toHaveProperty('transactionId');
      expect(data.data.amount).toBe(50);
      expect(data.data.currency).toBe('USD');
    });

    it('should handle invalid payment data', async () => {
      const req = new Request('http://localhost:8429/payment-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      const res = await testApp.request(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      
      expect(data.success).toBe(false);
      expect(data.error).toBe('Payment processing failed');
    });
  });
});
