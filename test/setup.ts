import { beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// テスト用の鍵ファイルの存在確認
beforeAll(() => {
  const keysDir = process.env.KEYS_DIR || join(process.cwd(), 'shared/keys');

  // 必要な鍵ファイルが存在するかチェック
  const requiredFiles = [
    'private.key',
    'public.key',
    'http-message-signatures-directory.json',
  ];

  const missingFiles = requiredFiles.filter(
    file => !existsSync(join(keysDir, file))
  );

  if (missingFiles.length > 0) {
    throw new Error(
      `必要な鍵ファイルが見つかりません: ${missingFiles.join(', ')}\n` +
        `READMEの「1. 鍵ペアの作成」セクションを参照して鍵ペアを生成してください。`
    );
  }

  // テスト用の環境変数を設定
  process.env.KEYS_DIR = keysDir;
});

// テスト後のクリーンアップ
afterAll(() => {
  // 必要に応じてテスト用ファイルを削除
});
