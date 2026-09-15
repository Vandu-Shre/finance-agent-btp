// Mock environment variables before importing anything
process.env.AZURE_OPENAI_API_KEY = 'test-api-key';
process.env.AZURE_OPENAI_INSTANCE_NAME = 'test-instance';
process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment';
process.env.AZURE_OPENAI_API_VERSION = '2024-02-15-preview';
process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME = 'test-embedding-deployment';
process.env.CHROMA_API_KEY = 'test-chroma-key';
process.env.TEMPERATURE = '0.7';

import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { FinanceAgent } from '../../agent/agents/finance-agent.js';

// ── Mock LangChain modules ──────────────────────────────────────────────────

const mockAgentInvoke = jest.fn();

jest.mock('@langchain/openai', () => ({
  AzureChatOpenAI: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('langchain', () => ({
  createAgent: jest.fn().mockImplementation(() => ({
    invoke: mockAgentInvoke,
  })),
}));

jest.mock('../../agent/tools/finance-tools.js', () => ({
  createSearchTool: jest.fn().mockReturnValue({ name: 'search_documents' }),
  calculateTool: { name: 'calculate' },
  compareTool: { name: 'compare_values' },
  extractFinancialDataTool: { name: 'extract_financial_data' },
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('FinanceAgent', () => {
  let agent: FinanceAgent;

  beforeEach(() => {
    mockAgentInvoke.mockReset();
    mockAgentInvoke.mockResolvedValue({
      messages: [new AIMessage('AI response')],
    });
    agent = new FinanceAgent();
  });

  // ── Initialization ────────────────────────────────────────────────────────

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

    it('should initialize Azure OpenAI and create agent', async () => {
      const { AzureChatOpenAI } = require('@langchain/openai');
      const { createAgent } = require('langchain');

      await agent.initialize('user-1');

      expect(AzureChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          azureOpenAIApiKey: expect.any(String),
          azureOpenAIApiVersion: expect.any(String),
          azureOpenAIApiInstanceName: expect.any(String),
          azureOpenAIApiDeploymentName: expect.any(String),
          temperature: expect.any(Number),
        })
      );
      expect(createAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.anything(),
          tools: expect.any(Array),
          systemPrompt: expect.any(String),
        })
      );
    });
  });

  // ── chat ──────────────────────────────────────────────────────────────────

  describe('chat', () => {
    it('should throw error if not initialized', async () => {
      await expect(agent.chat('Hello')).rejects.toThrow('Agent not initialized');
    });

    it('should invoke agent with input as HumanMessage and return output', async () => {
      let capturedMessages: any[] = [];
      mockAgentInvoke.mockImplementation((args: any) => {
        capturedMessages = args.messages.map((m: any) => ({
          type: m.constructor.name,
          content: m.content,
        }));
        return Promise.resolve({ messages: [new AIMessage('AI response')] });
      });

      await agent.initialize();
      const response = await agent.chat('Hello');

      expect(capturedMessages).toEqual([{ type: 'HumanMessage', content: 'Hello' }]);
      expect(response).toBe('AI response');
    });

    it('should add HumanMessage and AIMessage to chat history after a call', async () => {
      await agent.initialize();
      await agent.chat('Hello');

      const history = agent.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toBeInstanceOf(HumanMessage);
      expect(history[1]).toBeInstanceOf(AIMessage);
      expect((history[0] as HumanMessage).content).toBe('Hello');
      expect((history[1] as AIMessage).content).toBe('AI response');
    });

    it('should pass accumulated history on subsequent calls', async () => {
      const capturedHistoryLengths: number[] = [];
      let callCount = 0;
      mockAgentInvoke.mockImplementation((args: any) => {
        capturedHistoryLengths.push(args.messages.length);
        return Promise.resolve({ messages: [new AIMessage(`Response ${++callCount}`)] });
      });

      await agent.initialize();
      await agent.chat('First message');
      await agent.chat('Second message');

      // First call: 1 message (the human input only — history empty)
      // Second call: 3 messages (HumanMessage + AIMessage from first + new HumanMessage)
      expect(capturedHistoryLengths[0]).toBe(1);
      expect(capturedHistoryLengths[1]).toBe(3);
    });

    it('should accumulate history across multiple exchanges', async () => {
      const capturedHistoryLengths: number[] = [];
      let callCount = 0;
      mockAgentInvoke.mockImplementation((args: any) => {
        capturedHistoryLengths.push(args.messages.length);
        return Promise.resolve({ messages: [new AIMessage(`Response ${++callCount}`)] });
      });

      await agent.initialize();
      await agent.chat('Message 1');
      await agent.chat('Message 2');
      await agent.chat('Message 3');

      expect(capturedHistoryLengths[0]).toBe(1);
      expect(capturedHistoryLengths[1]).toBe(3);
      expect(capturedHistoryLengths[2]).toBe(5);
    });

    it('should handle errors from agent invocation', async () => {
      mockAgentInvoke.mockRejectedValue(new Error('API Error'));

      await agent.initialize();
      await expect(agent.chat('Hello')).rejects.toThrow('API Error');
    });

    it('should log errors via logger when agent invocation fails', async () => {
      const { logger } = await import('../../lib/logger.js');
      const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);

      mockAgentInvoke.mockRejectedValue(new Error('API Error'));
      await agent.initialize();

      try {
        await agent.chat('Hello');
      } catch {
        // expected
      }

      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in agent chat'),
        expect.objectContaining({ error: 'API Error' })
      );
      errSpy.mockRestore();
    });
  });

  // ── history management ────────────────────────────────────────────────────

  describe('history management', () => {
    it('should return empty array initially', () => {
      expect(agent.getHistory()).toEqual([]);
    });

    it('should clear chat history on reset', async () => {
      await agent.initialize();
      await agent.chat('Hello');
      expect(agent.getHistory()).toHaveLength(2);

      agent.resetHistory();
      expect(agent.getHistory()).toHaveLength(0);
    });

    it('should return a copy of the history', async () => {
      await agent.initialize();
      await agent.chat('Hello');

      const history1 = agent.getHistory();
      const history2 = agent.getHistory();

      expect(history1).toEqual(history2);
      expect(history1).not.toBe(history2);
    });

    it('should not allow external modification of history', async () => {
      await agent.initialize();
      await agent.chat('Hello');

      const history = agent.getHistory();
      history.push(new HumanMessage('injected'));

      expect(agent.getHistory()).toHaveLength(2);
    });

    it('should contain HumanMessage and AIMessage instances', async () => {
      await agent.initialize();
      await agent.chat('Question');

      const history = agent.getHistory();
      expect(history[0]).toBeInstanceOf(HumanMessage);
      expect(history[1]).toBeInstanceOf(AIMessage);
    });

    it('should handle multiple conversations', async () => {
      let callCount = 0;
      mockAgentInvoke.mockImplementation(() =>
        Promise.resolve({ messages: [new AIMessage(`Response ${++callCount}`)] })
      );

      await agent.initialize();
      await agent.chat('First');
      await agent.chat('Second');

      expect(agent.getHistory()).toHaveLength(4);
    });
  });
});
