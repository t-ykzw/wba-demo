import { describe, it, expect, beforeEach } from 'vitest';
import { AuthVerifier, RequestLike } from '../../../server/src/auth-verifier';
import { importPKCS8, SignJWT } from 'jose';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('AuthVerifier', () => {
  let authVerifier: AuthVerifier;
  let testPrivateKey: string;

  beforeEach(() => {
    authVerifier = new AuthVerifier();
    testPrivateKey = readFileSync(join(process.cwd(), 'test/keys/private.key'), 'utf8');
  });

  describe('verifyRequest', () => {
    it('should verify a valid signature', async () => {
      // 有効な署名を作成
      const keyLike = await importPKCS8(testPrivateKey, 'Ed25519');
      const now = Math.floor(Date.now() / 1000);
      
      const signedData = `"@method": GET
"@target-uri": http://localhost:8429/test
"@authority": localhost:8429
"@scheme": http
"@request-target": /test
"created": ${now}`;

      const jwt = await new SignJWT({
        '@method': 'GET',
        '@target-uri': 'http://localhost:8429/test',
        '@authority': 'localhost:8429',
        '@scheme': 'http',
        '@request-target': '/test',
        'created': now,
      })
        .setProtectedHeader({ alg: 'Ed25519', kid: 'test-key-id' })
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(keyLike);

      const request: RequestLike = {
        method: 'GET',
        url: 'http://localhost:8429/test',
        headers: {
          'signature': `sig1=:${Buffer.from(jwt).toString('base64')}:`,
          'signature-input': `sig1=("@method" "@target-uri" "@authority" "@scheme" "@request-target" "created");created=${now};keyid="test-key-id"`,
        },
      };

      const result = await authVerifier.verifyRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.keyId).toBe('test-key-id');
      expect(result.algorithm).toBe('Ed25519');
    });

    it('should reject request without signature header', async () => {
      const request: RequestLike = {
        method: 'GET',
        url: 'http://localhost:8429/test',
        headers: {},
      };

      const result = await authVerifier.verifyRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Signature header not found');
    });

    it('should reject request without signature-input header', async () => {
      const request: RequestLike = {
        method: 'GET',
        url: 'http://localhost:8429/test',
        headers: {
          'signature': 'sig1=:invalid:',
        },
      };

      const result = await authVerifier.verifyRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Signature-Input header not found');
    });

    it('should reject expired signature', async () => {
      const keyLike = await importPKCS8(testPrivateKey, 'Ed25519');
      const expiredTime = Math.floor(Date.now() / 1000) - 3600; // 1時間前
      
      const jwt = await new SignJWT({
        '@method': 'GET',
        '@target-uri': 'http://localhost:8429/test',
        '@authority': 'localhost:8429',
        '@scheme': 'http',
        '@request-target': '/test',
        'created': expiredTime,
      })
        .setProtectedHeader({ alg: 'Ed25519', kid: 'test-key-id' })
        .setIssuedAt(expiredTime)
        .setExpirationTime(expiredTime + 300)
        .sign(keyLike);

      const request: RequestLike = {
        method: 'GET',
        url: 'http://localhost:8429/test',
        headers: {
          'signature': `sig1=:${Buffer.from(jwt).toString('base64')}:`,
          'signature-input': `sig1=("@method" "@target-uri" "@authority" "@scheme" "@request-target" "created");created=${expiredTime};keyid="test-key-id"`,
        },
      };

      const result = await authVerifier.verifyRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Signature expired');
    });
  });
});
