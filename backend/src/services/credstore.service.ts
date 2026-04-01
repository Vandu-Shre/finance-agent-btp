import { createPrivateKey } from 'crypto';
import { request as httpsRequest } from 'https';
import { URL } from 'url';
import { compactDecrypt } from 'jose';

interface CredstoreBinding {
  url: string;
  username: string;
  certificate?: string;
  key?: string;
  encryption?: {
    client_private_key: string;
    server_public_key: string;
  };
}

interface CredstoreCredential {
  name: string;
  value: string;
  username?: string;
}

const CREDENTIAL_MAP: Record<string, string> = {
  'azure-openai-api-key': 'AZURE_OPENAI_API_KEY',
  'chroma-api-key': 'CHROMA_API_KEY',
};

function getBinding(): CredstoreBinding | null {
  const vcapServices = process.env.VCAP_SERVICES;
  if (!vcapServices) return null;

  const services = JSON.parse(vcapServices);
  const instances = services['credstore'];
  if (!instances?.length) return null;

  return instances[0].credentials as CredstoreBinding;
}

async function decryptJwe(jweToken: string, privateKeyBase64: string): Promise<CredstoreCredential> {
  const keyBuffer = Buffer.from(privateKeyBase64, 'base64');
  const privateKey = createPrivateKey({ key: keyBuffer, format: 'der', type: 'pkcs8' });
  const { plaintext } = await compactDecrypt(jweToken, privateKey);
  return JSON.parse(Buffer.from(plaintext).toString('utf-8')) as CredstoreCredential;
}

// binding.url already includes the base path (e.g. /api/v1/credentials),
// so we only append the credential type as a suffix.
async function fetchCredential(binding: CredstoreBinding, namespace: string, name: string): Promise<string> {
  const url = `${binding.url}/password?name=${encodeURIComponent(name)}`;
  const parsed = new URL(url);

  const body = await new Promise<string>((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname: parsed.hostname,
        port: Number(parsed.port) || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        headers: { 'sapcp-credstore-namespace': namespace },
        cert: binding.certificate,
        key: binding.key,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`Credential Store fetch failed for '${name}': ${res.statusCode} ${res.statusMessage}`));
          } else {
            resolve(data);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });

  // When payload encryption is enabled the entire response body is a JWE compact serialization.
  // After JWE decryption the value is plain text. Without encryption it is base64-encoded.
  if (binding.encryption?.client_private_key) {
    const data = await decryptJwe(body, binding.encryption.client_private_key);
    return data.value;
  }

  const data = JSON.parse(body) as CredstoreCredential;
  return Buffer.from(data.value, 'base64').toString('utf-8');
}

export async function getCredential(namespace: string, name: string): Promise<string | null> {
  const binding = getBinding();

  if (!binding) {
    const envVar = CREDENTIAL_MAP[name];
    return envVar ? (process.env[envVar] ?? null) : null;
  }

  try {
    return await fetchCredential(binding, namespace, name);
  } catch (error) {
    console.error(`❌ Failed to fetch credential '${name}' from Credential Store:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function loadCredentials(namespace: string): Promise<void> {
  const binding = getBinding();

  if (!binding) {
    console.log('ℹ️  No Credential Store binding found, using environment variables');
    return;
  }

  console.log('🔐 Loading credentials from BTP Credential Store...');

  for (const [credName, envVar] of Object.entries(CREDENTIAL_MAP)) {
    try {
      const value = await fetchCredential(binding, namespace, credName);
      process.env[envVar] = value;
      console.log(`✅ Loaded ${envVar} from Credential Store`);
    } catch (error) {
      console.error(`❌ Failed to load ${envVar} from Credential Store:`, error instanceof Error ? error.message : error);
    }
  }
}
