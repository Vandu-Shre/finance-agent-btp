// Set up env before any imports
const originalVcapServices = process.env.VCAP_SERVICES;

// Mock crypto module
jest.mock('crypto', () => ({
  createPrivateKey: jest.fn().mockReturnValue('mock-private-key'),
  privateDecrypt: jest.fn().mockReturnValue(Buffer.from('decrypted-value')),
  constants: { RSA_PKCS1_OAEP_PADDING: 4 },
}));

import { loadCredentials } from '../../services/credstore.service.js';

const BINDING_NO_ENCRYPTION = {
  url: 'https://credstore.example.com',
  username: 'testuser',
  password: 'testpass',
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
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
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

      expect(mockFetch).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No Credential Store binding found')
      );
      consoleSpy.mockRestore();
    });

    it('should return early when credstore service is absent from VCAP_SERVICES', async () => {
      process.env.VCAP_SERVICES = JSON.stringify({ 'other-service': [] });

      await loadCredentials('finance-agent');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return early when credstore instances array is empty', async () => {
      process.env.VCAP_SERVICES = JSON.stringify({ credstore: [] });

      await loadCredentials('finance-agent');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('loadCredentials - successful fetch without encryption', () => {
    beforeEach(() => {
      setVcapServices(BINDING_NO_ENCRYPTION);
    });

    it('should fetch both credentials and set env vars', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: Buffer.from('azure-key-value').toString('base64') }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: Buffer.from('chroma-key-value').toString('base64') }),
        });

      await loadCredentials('finance-agent');

      expect(process.env.AZURE_OPENAI_API_KEY).toBe('azure-key-value');
      expect(process.env.CHROMA_API_KEY).toBe('chroma-key-value');
    });

    it('should call fetch with correct URL including namespace and credential name', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ value: Buffer.from('val').toString('base64') }),
      });

      await loadCredentials('my-namespace');

      const firstUrl = mockFetch.mock.calls[0][0] as string;
      expect(firstUrl).toContain('https://credstore.example.com');
      expect(firstUrl).toContain('/api/v1/credentials/password');
      expect(firstUrl).toContain('namespace=my-namespace');
      expect(firstUrl).toContain('name=azure-openai-api-key');
    });

    it('should send correct Basic Auth header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ value: Buffer.from('val').toString('base64') }),
      });

      await loadCredentials('finance-agent');

      const expectedAuth =
        'Basic ' + Buffer.from('testuser:testpass').toString('base64');
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe(expectedAuth);
    });

    it('should make exactly 2 fetch calls (one per credential)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ value: Buffer.from('val').toString('base64') }),
      });

      await loadCredentials('finance-agent');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadCredentials - error handling', () => {
    beforeEach(() => {
      setVcapServices(BINDING_NO_ENCRYPTION);
    });

    it('should not throw when fetch rejects', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(loadCredentials('finance-agent')).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });

    it('should log error when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await loadCredentials('finance-agent');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load AZURE_OPENAI_API_KEY'),
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });

    it('should not throw when server returns non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(loadCredentials('finance-agent')).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });

    it('should continue loading remaining credentials after one fails', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('First credential failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: Buffer.from('chroma-key-value').toString('base64') }),
        });
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

    it('should decrypt value using RSA when encryption keys are present', async () => {
      const { privateDecrypt } = require('crypto');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ value: Buffer.from('encrypted-payload').toString('base64') }),
      });

      await loadCredentials('finance-agent');

      expect(privateDecrypt).toHaveBeenCalled();
      expect(process.env.AZURE_OPENAI_API_KEY).toBe('decrypted-value');
    });

    it('should call createPrivateKey with the client private key from binding', async () => {
      const { createPrivateKey } = require('crypto');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ value: Buffer.from('encrypted').toString('base64') }),
      });

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
