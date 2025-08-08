import { readFileSync, writeFileSync } from 'fs';
import { argv } from 'process';
import { importSPKI, exportJWK } from 'jose';

async function main() {
  const algIndex = argv.indexOf('--algorithm');
  const pubIndex = argv.indexOf('--public-key');
  const outIndex = argv.indexOf('--output');

  if (algIndex === -1 || pubIndex === -1 || outIndex === -1) {
    console.error(
      'Usage: --algorithm Ed25519 --public-key <path> --output <path>'
    );
    process.exit(1);
  }

  const algorithm = argv[algIndex + 1];
  const publicKeyPath = argv[pubIndex + 1];
  const outputPath = argv[outIndex + 1];

  const pem = readFileSync(publicKeyPath, 'utf8');
  const keyLike = await importSPKI(pem, algorithm);
  const jwk = await exportJWK(keyLike);
  jwk.kid = 'my-key-id';

  const output = { keys: [jwk] };
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`✅ Wrote JWK to ${outputPath}`);
}

(async () => {
  await main();
})();
