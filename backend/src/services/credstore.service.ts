import { createPrivateKey, privateDecrypt, constants } from 'crypto';

interface CredstoreBinding {
  url: string;
  username: string;
  password: string;
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

function decryptValue(encryptedBase64: string, privateKeyBase64: string): string {
  const keyBuffer = Buffer.from(privateKeyBase64, 'base64');
  const privateKey = createPrivateKey({ key: keyBuffer, format: 'der', type: 'pkcs8' });

  const decrypted = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(encryptedBase64, 'base64')
  );

  return decrypted.toString('utf-8');
}

async function fetchCredential(binding: CredstoreBinding, namespace: string, name: string): Promise<string> {
  const url = `${binding.url}/api/v1/credentials/password?namespace=${encodeURIComponent(namespace)}&name=${encodeURIComponent(name)}`;
  const auth = Buffer.from(`${binding.username}:${binding.password}`).toString('base64');

  const response = await fetch(url, {
    headers: { 'Authorization': `Basic ${auth}` },
  });

  if (!response.ok) {
    throw new Error(`Credential Store fetch failed for '${name}': ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as CredstoreCredential;

  if (binding.encryption?.client_private_key) {
    return decryptValue(data.value, binding.encryption.client_private_key);
  }

  return Buffer.from(data.value, 'base64').toString('utf-8');
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
