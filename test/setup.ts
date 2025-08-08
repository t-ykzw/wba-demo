import { beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// テスト用の鍵ファイルを作成
beforeAll(() => {
  const testKeysDir = join(process.cwd(), 'test/keys');
  
  // テスト用の鍵ファイルが存在しない場合は作成
  try {
    readFileSync(join(testKeysDir, 'private.key'));
  } catch {
    // テスト用の鍵ファイルを作成
    const privateKey = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIJ+DYvh6SE4VJbIqRbsE5YyAuBUj8M4Sxzi3yjXZxN0T
-----END PRIVATE KEY-----`;
    
    const publicKey = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAH4Ni+HpIThUlsipFuwTljIC4FSPwzhLHOLfKNdnE3RM=
-----END PUBLIC KEY-----`;
    
    const jwkData = {
      keys: [
        {
          kty: 'OKP',
          crv: 'Ed25519',
          kid: 'test-key-id',
          x: 'H4Ni-HpIThUlsipFuwTljIC4FSPwzhLHOLfKNdnE3RM',
        },
      ],
    };
    
    writeFileSync(join(testKeysDir, 'private.key'), privateKey);
    writeFileSync(join(testKeysDir, 'public.key'), publicKey);
    writeFileSync(
      join(testKeysDir, 'http-message-signatures-directory.json'),
      JSON.stringify(jwkData, null, 2)
    );
  }
  
  // テスト用の環境変数を設定
  process.env.KEYS_DIR = testKeysDir;
});

// テスト後のクリーンアップ
afterAll(() => {
  // 必要に応じてテスト用ファイルを削除
});
