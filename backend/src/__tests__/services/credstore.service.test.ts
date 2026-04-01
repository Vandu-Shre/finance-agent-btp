// Set up env before any imports
const originalVcapServices = process.env.VCAP_SERVICES;

// Mock crypto module
jest.mock('crypto', () => ({
  createPrivateKey: jest.fn().mockReturnValue('mock-private-key'),
  constants: { RSA_PKCS1_OAEP_PADDING: 4 },
}));

// Mock jose for JWE decryption
jest.mock('jose', () => ({
  compactDecrypt: jest.fn().mockResolvedValue({
    plaintext: Buffer.from(JSON.stringify({ name: 'test', value: 'decrypted-value' })),
  }),
}));

// Mock https module
import https from 'https';
jest.mock('https');

import { loadCredentials } from '../../services/credstore.service.js';

interface MockRes {
  statusCode: number;
  statusMessage: string;
  on: jest.Mock;
}

// Helper to create a mock https response
function mockHttpsResponse(statusCode: number, body: string) {
  const res: MockRes = {
    statusCode,
    statusMessage: statusCode >= 400 ? 'Error' : 'OK',
    on: jest.fn((event: string, handler: (data?: unknown) => void) => {
      if (event === 'data') handler(body);
      if (event === 'end') handler();
      return res;
    }),
  };
  const req = { on: jest.fn().mockReturnThis(), end: jest.fn() };
  (https.request as jest.Mock).mockImplementationOnce((_opts: unknown, callback: (res: MockRes) => void) => {
    callback(res);
    return req;
  });
  return { res, req };
}

const BINDING_NO_ENCRYPTION = {
  url: 'https://credstore.example.com/api/v1/credentials',
  username: 'testuser',
  certificate: 'test-cert',
  key: 'test-key',
};

const BINDING_WITH_ENCRYPTION = {
  ...BINDING_NO_ENCRYPTION,
  encryption: {
    client_private_key: Buffer.from('fake-private-key').toString('base64'),
    server_public_key: Buffer.from('fake-public-key').toString('base64'),
  },
};

function setVcapServices(credentials: object) {
  process.env.VCAP_SERVICES = JSON.stringify({
    credstore: [{ credentials }],
  });
}

describe('Credstore Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.CHROMA_API_KEY;
  });

  afterEach(() => {
    process.env.VCAP_SERVICES = originalVcapServices;
  });

  describe('loadCredentials - no binding', () => {
    it('should return early and log when VCAP_SERVICES is not set', async () => {
      delete process.env.VCAP_SERVICES;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await loadCredentials('finance-agent');

      expect(https.request).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No Credential Store binding found')
      );
      consoleSpy.mockRestore();
    });

    it('should return early when credstore service is absent from VCAP_SERVICES', async () => {
      process.env.VCAP_SERVICES = JSON.stringify({ 'other-service': [] });

      await loadCredentials('finance-agent');

      expect(https.request).not.toHaveBeenCalled();
    });

    it('should return early when credstore instances array is empty', async () => {
      process.env.VCAP_SERVICES = JSON.stringify({ credstore: [] });

      await loadCredentials('finance-agent');

      expect(https.request).not.toHaveBeenCalled();
    });
  });

  describe('loadCredentials - successful fetch without encryption', () => {
    beforeEach(() => {
      setVcapServices(BINDING_NO_ENCRYPTION);
    });

    it('should fetch both credentials and set env vars', async () => {
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('azure-key-value').toString('base64') }));
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('chroma-key-value').toString('base64') }));

      await loadCredentials('finance-agent');

      expect(process.env.AZURE_OPENAI_API_KEY).toBe('azure-key-value');
      expect(process.env.CHROMA_API_KEY).toBe('chroma-key-value');
    });

    it('should call https.request with correct URL including base path and credential name', async () => {
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('val').toString('base64') }));
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('val').toString('base64') }));

      await loadCredentials('my-namespace');

      const firstCall = (https.request as jest.Mock).mock.calls[0][0];
      expect(firstCall.hostname).toBe('credstore.example.com');
      expect(firstCall.path).toContain('/api/v1/credentials/password');
      expect(firstCall.path).toContain('name=azure-openai-api-key');
      expect(firstCall.path).not.toContain('namespace=');
    });

    it('should send sapcp-credstore-namespace header', async () => {
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('val').toString('base64') }));
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('val').toString('base64') }));

      await loadCredentials('finance-agent');

      const firstCall = (https.request as jest.Mock).mock.calls[0][0];
      expect(firstCall.headers['sapcp-credstore-namespace']).toBe('finance-agent');
    });

    it('should pass certificate and key for mTLS', async () => {
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('val').toString('base64') }));
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('val').toString('base64') }));

      await loadCredentials('finance-agent');

      const firstCall = (https.request as jest.Mock).mock.calls[0][0];
      expect(firstCall.cert).toBe('test-cert');
      expect(firstCall.key).toBe('test-key');
    });

    it('should make exactly 2 requests (one per credential)', async () => {
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('val').toString('base64') }));
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('val').toString('base64') }));

      await loadCredentials('finance-agent');

      expect(https.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadCredentials - error handling', () => {
    beforeEach(() => {
      setVcapServices(BINDING_NO_ENCRYPTION);
    });

    it('should not throw when request emits an error', async () => {
      const req = { on: jest.fn(), end: jest.fn() };
      let errorHandler: ((e: Error) => void) | undefined;
      req.on.mockImplementation((event: string, handler: (e: Error) => void) => {
        if (event === 'error') errorHandler = handler;
        return req;
      });
      (https.request as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => errorHandler?.(new Error('Network error')), 0);
        return req;
      });
      // Second credential also needs a mock
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('val').toString('base64') }));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await expect(loadCredentials('finance-agent')).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });

    it('should log error when request fails', async () => {
      const req = { on: jest.fn(), end: jest.fn() };
      let errorHandler: ((e: Error) => void) | undefined;
      req.on.mockImplementation((event: string, handler: (e: Error) => void) => {
        if (event === 'error') errorHandler = handler;
        return req;
      });
      (https.request as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => errorHandler?.(new Error('Network error')), 0);
        return req;
      });
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('val').toString('base64') }));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await loadCredentials('finance-agent');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load AZURE_OPENAI_API_KEY'),
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });

    it('should not throw when server returns non-ok response', async () => {
      mockHttpsResponse(403, 'Forbidden');
      mockHttpsResponse(403, 'Forbidden');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await expect(loadCredentials('finance-agent')).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });

    it('should continue loading remaining credentials after one fails', async () => {
      mockHttpsResponse(403, 'Forbidden');
      mockHttpsResponse(200, JSON.stringify({ value: Buffer.from('chroma-key-value').toString('base64') }));

      jest.spyOn(console, 'error').mockImplementation();
      await loadCredentials('finance-agent');

      expect(process.env.AZURE_OPENAI_API_KEY).toBeUndefined();
      expect(process.env.CHROMA_API_KEY).toBe('chroma-key-value');
    });
  });

  describe('loadCredentials - with encryption', () => {
    beforeEach(() => {
      setVcapServices(BINDING_WITH_ENCRYPTION);
    });

    it('should JWE-decrypt the response when encryption keys are present', async () => {
      const { compactDecrypt } = require('jose');
      mockHttpsResponse(200, 'eyJhbGciOiJSU0EtT0FFUCJ9.fake.jwe.token.here');
      mockHttpsResponse(200, 'eyJhbGciOiJSU0EtT0FFUCJ9.fake.jwe.token.here');

      await loadCredentials('finance-agent');

      expect(compactDecrypt).toHaveBeenCalled();
      expect(process.env.AZURE_OPENAI_API_KEY).toBe('decrypted-value');
    });

    it('should call createPrivateKey with the client private key from binding', async () => {
      const { createPrivateKey } = require('crypto');
      mockHttpsResponse(200, 'eyJhbGciOiJSU0EtT0FFUCJ9.fake.jwe.token.here');
      mockHttpsResponse(200, 'eyJhbGciOiJSU0EtT0FFUCJ9.fake.jwe.token.here');

      await loadCredentials('finance-agent');

      expect(createPrivateKey).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'der',
          type: 'pkcs8',
        })
      );
    });
  });
});
