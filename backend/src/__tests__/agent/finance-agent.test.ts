// Mock environment variables before importing anything
process.env.AZURE_OPENAI_API_KEY = 'test-api-key';
process.env.AZURE_OPENAI_INSTANCE_NAME = 'test-instance';
process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment';
process.env.AZURE_OPENAI_API_VERSION = '2024-02-15-preview';
process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME = 'test-embedding-deployment';
process.env.CHROMA_API_KEY = 'test-chroma-key';
process.env.TEMPERATURE = '0.7';

import { FinanceAgent } from '../../agent/agents/finance-agent.js';

// Mock LangChain modules
jest.mock('@langchain/openai', () => ({
  AzureChatOpenAI: jest.fn().mockImplementation(() => ({
    pipe: jest.fn().mockReturnThis(),
  })),
}));

jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnThis(),
    }),
  },
}));

jest.mock('@langchain/core/output_parsers', () => ({
  StringOutputParser: jest.fn().mockImplementation(() => ({})),
}));

describe('FinanceAgent', () => {
  let agent: FinanceAgent;
  let mockChainInvoke: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create a mock for chain.invoke
    mockChainInvoke = jest.fn();

    // Set up the chain mock to return an object with invoke method
    const mockChain = {
      invoke: mockChainInvoke,
    };

    // Make pipe() return the chain with invoke
    const mockPipe = jest.fn().mockReturnValue(mockChain);

    const AzureChatOpenAI = require('@langchain/openai').AzureChatOpenAI;
    const ChatPromptTemplate = require('@langchain/core/prompts').ChatPromptTemplate;
    const StringOutputParser = require('@langchain/core/output_parsers').StringOutputParser;

    // Set up the full mock chain
    AzureChatOpenAI.mockImplementation(() => ({}));

    ChatPromptTemplate.fromMessages.mockReturnValue({
      pipe: jest.fn().mockImplementation(() => ({
        pipe: jest.fn().mockReturnValue(mockChain),
      })),
    });

    StringOutputParser.mockImplementation(() => ({}));

    agent = new FinanceAgent();
  });

  describe('initialization', () => {
    it('should create a new agent instance', () => {
      expect(agent).toBeInstanceOf(FinanceAgent);
    });

    it('should have chat method', () => {
      expect(typeof agent.chat).toBe('function');
    });

    it('should have resetHistory method', () => {
      expect(typeof agent.resetHistory).toBe('function');
    });

    it('should have getHistory method', () => {
      expect(typeof agent.getHistory).toBe('function');
    });

    it('should have initialize method', () => {
      expect(typeof agent.initialize).toBe('function');
    });

    it('should initialize Azure OpenAI and create chain', async () => {
      const AzureChatOpenAI = require('@langchain/openai').AzureChatOpenAI;
      const ChatPromptTemplate = require('@langchain/core/prompts').ChatPromptTemplate;
      const StringOutputParser = require('@langchain/core/output_parsers').StringOutputParser;

      await agent.initialize();

      expect(AzureChatOpenAI).toHaveBeenCalledWith({
        azureOpenAIApiKey: expect.any(String),
        azureOpenAIApiVersion: expect.any(String),
        azureOpenAIApiInstanceName: expect.any(String),
        azureOpenAIApiDeploymentName: expect.any(String),
        temperature: expect.any(Number),
      });
      expect(ChatPromptTemplate.fromMessages).toHaveBeenCalled();
      expect(StringOutputParser).toHaveBeenCalled();
    });
  });

  describe('chat', () => {
    it('should throw error if not initialized', async () => {
      await expect(agent.chat('Hello')).rejects.toThrow(
        'Agent not initialized'
      );
    });

    it('should invoke chain with input and empty history', async () => {
      mockChainInvoke.mockResolvedValue('AI response');

      await agent.initialize();
      const response = await agent.chat('Hello');

      expect(mockChainInvoke).toHaveBeenCalledWith({
        input: 'Hello',
        chat_history: '',
        context: expect.any(String),
      });
      expect(response).toBe('AI response');
    });

    it('should add messages to chat history', async () => {
      mockChainInvoke.mockResolvedValue('AI response');

      await agent.initialize();
      await agent.chat('Hello');

      const history = agent.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ role: 'User', content: 'Hello' });
      expect(history[1]).toEqual({ role: 'Assistant', content: 'AI response' });
    });

    it('should include previous chat history in subsequent calls', async () => {
      mockChainInvoke
        .mockResolvedValueOnce('First response')
        .mockResolvedValueOnce('Second response');

      await agent.initialize();
      await agent.chat('First message');
      await agent.chat('Second message');

      expect(mockChainInvoke).toHaveBeenNthCalledWith(2, {
        input: 'Second message',
        chat_history: 'User: First message\nAssistant: First response',
        context: expect.any(String),
      });
    });

    it('should format chat history correctly with multiple exchanges', async () => {
      mockChainInvoke
        .mockResolvedValueOnce('Response 1')
        .mockResolvedValueOnce('Response 2')
        .mockResolvedValueOnce('Response 3');

      await agent.initialize();
      await agent.chat('Message 1');
      await agent.chat('Message 2');
      await agent.chat('Message 3');

      expect(mockChainInvoke).toHaveBeenNthCalledWith(3, {
        input: 'Message 3',
        chat_history:
          'User: Message 1\nAssistant: Response 1\nUser: Message 2\nAssistant: Response 2',
        context: expect.any(String),
      });
    });

    it('should handle errors from chain invocation', async () => {
      const error = new Error('API Error');
      mockChainInvoke.mockRejectedValue(error);

      await agent.initialize();

      await expect(agent.chat('Hello')).rejects.toThrow('API Error');
    });

    it('should log errors when chain invocation fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('API Error');
      mockChainInvoke.mockRejectedValue(error);

      await agent.initialize();

      try {
        await agent.chat('Hello');
      } catch (e) {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith('Error in agent chat:', error);
      consoleSpy.mockRestore();
    });
  });

  describe('history management', () => {
    it('should return empty array initially', () => {
      expect(agent.getHistory()).toEqual([]);
    });

    it('should clear chat history on reset', () => {
      // Manually add some history for testing
      (agent as any).chatHistory = [
        { role: 'User', content: 'Test' },
        { role: 'Assistant', content: 'Response' },
      ];

      expect(agent.getHistory()).toHaveLength(2);

      agent.resetHistory();
      expect(agent.getHistory()).toHaveLength(0);
    });

    it('should return a copy of the history', () => {
      (agent as any).chatHistory = [
        { role: 'User', content: 'Test' },
      ];

      const history1 = agent.getHistory();
      const history2 = agent.getHistory();

      expect(history1).toEqual(history2);
      expect(history1).not.toBe(history2); // Different objects
    });

    it('should not allow external modification of history', () => {
      (agent as any).chatHistory = [
        { role: 'User', content: 'Test' },
      ];

      const history = agent.getHistory();
      history.push({ role: 'Hacker', content: 'Injected' });

      const actualHistory = agent.getHistory();
      expect(actualHistory).toHaveLength(1); // Not 2
    });

    it('should format history correctly', () => {
      (agent as any).chatHistory = [
        { role: 'User', content: 'Question' },
        { role: 'Assistant', content: 'Answer' },
      ];

      const history = agent.getHistory();
      expect(history[0]?.role).toBe('User');
      expect(history[1]?.role).toBe('Assistant');
    });

    it('should handle multiple conversations', () => {
      (agent as any).chatHistory = [
        { role: 'User', content: 'First' },
        { role: 'Assistant', content: 'First response' },
        { role: 'User', content: 'Second' },
        { role: 'Assistant', content: 'Second response' },
      ];

      const history = agent.getHistory();
      expect(history).toHaveLength(4);
    });
  });
});
