import { readFileSync } from 'fs';
import { join } from 'path';
import { importSPKI, jwtVerify } from 'jose';

// 構造化ログ用のlogger
const log = {
  error: (message: string, error?: any) => {
    console.log(JSON.stringify({ level: 'error', message, timestamp: new Date().toISOString(), error: error?.message || error }));
  }
};

export interface RequestLike {
  method: string;
  url: string;
  headers: Record<string, string>;
}

export interface VerificationResult {
  isValid: boolean;
  error?: string;
  keyId?: string;
  algorithm?: string;
}

export class AuthVerifier {
  private publicKey: string;
  private jwkData: any;

  constructor() {
    try {
      const publicKeyPath = join(process.cwd(), '../shared/keys/public.key');
      this.publicKey = readFileSync(publicKeyPath, 'utf8');
      
      const jwkPath = join(process.cwd(), '../shared/keys/http-message-signatures-directory.json');
      const jwkText = readFileSync(jwkPath, 'utf8');
      this.jwkData = JSON.parse(jwkText);
    } catch (error) {
      log.error('鍵ファイルの読み込みエラー', error);
      throw new Error('鍵ファイルの読み込みに失敗しました');
    }
  }

  private extractHeader(headers: Record<string, string>, name: string): string | null {
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return null;
  }

  private parseSignatureInput(signatureInput: string): {
    key: string;
    components: string[];
    parameters: Record<string, string>;
  } {
    // sig1=("@method" "@target-uri" "@authority" "@scheme" "@request-target" "created");created=1710000000;keyid="my-key-id"
    const match = signatureInput.match(/^([^=]+)=\(([^)]+)\)(.*)$/);
    if (!match) {
      throw new Error('Invalid Signature-Input format');
    }

    const key = match[1];
    const components = match[2].split(' ').map(c => c.replace(/"/g, ''));
    const parameters: Record<string, string> = {};

    // パラメータを解析
    const paramsStr = match[3];
    const paramMatches = paramsStr.matchAll(/;([^=]+)=([^;]+)/g);
    for (const paramMatch of paramMatches) {
      const name = paramMatch[1];
      let value = paramMatch[2];
      // クォートを除去
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      parameters[name] = value;
    }

    return { key, components, parameters };
  }

  private parseSignature(signature: string): string {
    // sig1=:base64signature:
    const match = signature.match(/^[^=]+=:([^:]+):$/);
    if (!match) {
      throw new Error('Invalid Signature format');
    }
    return match[1];
  }

  private buildSignedData(request: RequestLike, components: string[], signatureInputString: string): string {
    const parts: string[] = [];

    for (const component of components) {
      let value: string;

      switch (component) {
        case '@method':
          value = request.method.toUpperCase();
          break;
        case '@target-uri':
          value = request.url;
          break;
        case '@authority': {
          const url = new URL(request.url);
          const port = url.port ? parseInt(url.port, 10) : null;
          value = `${url.hostname}${port && ![80, 443].includes(port) ? `:${port}` : ""}`;
          break;
        }
        case '@scheme':
          value = new URL(request.url).protocol.slice(0, -1);
          break;
        case '@request-target': {
          const url = new URL(request.url);
          value = `${url.pathname}${url.search}`;
          break;
        }
        case 'created':
          value = this.extractHeader(request.headers, 'created') || '';
          break;
        default:
          // カスタムヘッダー
          value = this.extractHeader(request.headers, component) || '';
      }

      parts.push(`"${component.toLowerCase()}": ${value}`);
    }

    parts.push(`"@signature-params": ${signatureInputString}`);
    return parts.join('\n');
  }

  async verifyRequest(request: RequestLike): Promise<VerificationResult> {
    try {
      // Signature-Inputヘッダーを取得
      const signatureInput = this.extractHeader(request.headers, 'signature-input');
      if (!signatureInput) {
        return { isValid: false, error: 'Signature-Input header not found' };
      }

      // Signatureヘッダーを取得
      const signature = this.extractHeader(request.headers, 'signature');
      if (!signature) {
        return { isValid: false, error: 'Signature header not found' };
      }

      // Signature-Inputを解析
      const { key, components, parameters } = this.parseSignatureInput(signatureInput);
      
      // 署名を解析
      const signatureValue = this.parseSignature(signature);

      // 有効期限チェック
      if (parameters.expires) {
        const expires = parseInt(parameters.expires);
        const now = Math.floor(Date.now() / 1000);
        if (expires < now) {
          return { isValid: false, error: 'Signature expired' };
        }
      }

      // 署名データを構築
      const signedData = this.buildSignedData(request, components, signatureInput);

      // 公開鍵で署名を検証
      const keyLike = await importSPKI(this.publicKey, 'Ed25519');
      const signatureBuffer = Buffer.from(signatureValue, 'base64');

      try {
        // JWTとして検証
        const jwt = Buffer.from(signatureValue, 'base64').toString('utf8');
        await jwtVerify(jwt, keyLike);
        return {
          isValid: true,
          keyId: parameters.keyid,
          algorithm: 'Ed25519'
        };
      } catch (verifyError) {
        return {
          isValid: false,
          error: `Signature verification failed: ${verifyError}`
        };
      }

    } catch (error) {
      return {
        isValid: false,
        error: `Verification error: ${error}`
      };
    }
  }
}
