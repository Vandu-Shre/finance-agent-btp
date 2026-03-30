// Mock environment variables before importing config
process.env.AZURE_OPENAI_ENDPOINT = 'https://test-instance.openai.azure.com';
process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment';
process.env.AZURE_OPENAI_API_VERSION = '2024-02-15-preview';
process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME = 'test-embedding-deployment';
process.env.TEMPERATURE = '0.7';

import { agentConfig, initConfig } from '../../agent/config/index.js';

jest.mock('../../services/credstore.service.js', () => ({
  getCredential: jest.fn().mockImplementation((_namespace: string, name: string) => {
    const map: Record<string, string> = {
      'azure-openai-api-key': 'test-api-key',
      'chroma-api-key': 'test-chroma-key',
    };
    return Promise.resolve(map[name] ?? null);
  }),
}));

describe('Agent Configuration', () => {
  beforeAll(async () => {
    await initConfig();
  });

  it('should export agentConfig', () => {
    expect(agentConfig).toBeDefined();
  });

  it('should have azure configuration', () => {
    expect(agentConfig.azure).toBeDefined();
    expect(agentConfig.azure.apiKey).toBeDefined();
    expect(agentConfig.azure.endpoint).toBeDefined();
    expect(agentConfig.azure.deploymentName).toBeDefined();
    expect(agentConfig.azure.apiVersion).toBeDefined();
    expect(agentConfig.azure.temperature).toBeDefined();
  });

  it('should have correct default values', () => {
    expect(typeof agentConfig.azure.apiKey).toBe('string');
    expect(typeof agentConfig.azure.endpoint).toBe('string');
    expect(typeof agentConfig.azure.deploymentName).toBe('string');
    expect(typeof agentConfig.azure.apiVersion).toBe('string');
    expect(typeof agentConfig.azure.temperature).toBe('number');
    expect(agentConfig.azure.temperature).toBeGreaterThanOrEqual(0);
    expect(agentConfig.azure.temperature).toBeLessThanOrEqual(2);
  });

  it('should load apiKeys from Credential Store and other values from environment variables', () => {
    expect(agentConfig.azure.apiKey).toBe('test-api-key');
    expect(agentConfig.chroma.apiKey).toBe('test-chroma-key');
    expect(agentConfig.azure.endpoint).toBe('https://test-instance.openai.azure.com');
    expect(agentConfig.azure.deploymentName).toBe('test-deployment');
    expect(agentConfig.azure.apiVersion).toBe('2024-02-15-preview');
    expect(agentConfig.azure.temperature).toBe(0.7);
  });
});
