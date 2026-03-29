import FinanceAgentSDK, { FileClient, ChatClient } from '../index.js';

describe('FinanceAgentSDK', () => {
  const config = {
    baseUrl: 'https://test-app.cfapps.example.com',
    authToken: 'test-token',
  };

  it('should initialize with FileClient and ChatClient', () => {
    const sdk = new FinanceAgentSDK(config);

    expect(sdk.files).toBeInstanceOf(FileClient);
    expect(sdk.chat).toBeInstanceOf(ChatClient);
  });

  it('should pass config to both clients', () => {
    const sdk = new FinanceAgentSDK(config);

    expect(sdk.files).toBeDefined();
    expect(sdk.chat).toBeDefined();
  });

  it('should export FileClient', () => {
    expect(FileClient).toBeDefined();
  });

  it('should export ChatClient', () => {
    expect(ChatClient).toBeDefined();
  });

  it('should be default export', () => {
    expect(FinanceAgentSDK).toBeDefined();
  });
});
