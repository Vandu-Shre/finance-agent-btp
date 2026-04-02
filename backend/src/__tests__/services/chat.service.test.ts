import { ChatService } from '../../services/chat.service.js';

jest.mock('../../services/db.service.js', () => ({
  prisma: {
    session: { create: jest.fn().mockResolvedValue({}) },
    message: { create: jest.fn().mockResolvedValue({}) },
  },
}));

jest.mock('../../services/file.service.js', () => ({
  __esModule: true,
  default: { getAllFiles: jest.fn().mockResolvedValue([]) },
}));

// Mock the FinanceAgent to avoid ES module import issues
jest.mock('../../agent/index.js', () => ({
  FinanceAgent: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    chat: jest.fn().mockImplementation((message: string) => {
      // Mock agent responses based on message content
      if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
        return Promise.resolve('Hello! How can I help you with your finances today?');
      } else if (message.toLowerCase().includes('help')) {
        return Promise.resolve('I can help you with various financial tasks. What do you need help with?');
      } else if (message.toLowerCase().includes('upload')) {
        return Promise.resolve('You can upload files by clicking the "Upload File" button in the Files section.');
      } else {
        return Promise.resolve('I understand. Let me help you with that.');
      }
    }),
  })),
  initializeVectorStore: jest.fn().mockResolvedValue(undefined),
  indexDocumentFromBuffer: jest.fn().mockResolvedValue(undefined),
  searchDocuments: jest.fn().mockResolvedValue([]),
}));

const flushPromises = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

describe('ChatService', () => {
  let chatService: ChatService;

  beforeEach(() => {
    chatService = new ChatService();
  });

  describe('Broadcast Callback', () => {
    it('should call broadcast callback when user message is added', () => {
      const mockBroadcast = jest.fn();
      chatService.setBroadcastCallback(mockBroadcast);

      chatService.addUserMessage('Test message');

      // Should broadcast: userMessage + typingStart
      expect(mockBroadcast).toHaveBeenCalledTimes(2);
      expect(mockBroadcast).toHaveBeenCalledWith('userMessage', expect.objectContaining({
        text: 'Test message',
        sender: 'user'
      }));
      expect(mockBroadcast).toHaveBeenCalledWith('typingStart', { isTyping: true });
    });

    it('should call broadcast callback when agent responds', async () => {
      const mockBroadcast = jest.fn();
      chatService.setBroadcastCallback(mockBroadcast);

      chatService.addUserMessage('Hello');

      // Wait for agent response (allow time for async agent call to complete)
      await flushPromises();

      // Should broadcast: userMessage, typingStart, systemMessage (no docs), agentMessage, typingStop
      expect(mockBroadcast).toHaveBeenCalledTimes(5);
      expect(mockBroadcast).toHaveBeenCalledWith('agentMessage', expect.objectContaining({
        sender: 'agent'
      }));
      expect(mockBroadcast).toHaveBeenCalledWith('typingStop', { isTyping: false });
    });

    it('should call broadcast callback when session is reset', () => {
      const mockBroadcast = jest.fn();
      chatService.setBroadcastCallback(mockBroadcast);

      const session = chatService.startNewSession();

      expect(mockBroadcast).toHaveBeenCalledWith('sessionReset', {
        sessionId: session.sessionId,
        createdAt: session.createdAt
      });
    });

    it('should not throw error when broadcast callback is not set', () => {
      // No callback set
      expect(() => {
        chatService.addUserMessage('Test');
      }).not.toThrow();
    });

    it('should allow changing broadcast callback', () => {
      const mockBroadcast1 = jest.fn();
      const mockBroadcast2 = jest.fn();

      chatService.setBroadcastCallback(mockBroadcast1);
      chatService.addUserMessage('First');

      expect(mockBroadcast1).toHaveBeenCalled();
      expect(mockBroadcast2).not.toHaveBeenCalled();

      mockBroadcast1.mockClear();

      chatService.setBroadcastCallback(mockBroadcast2);
      chatService.addUserMessage('Second');

      expect(mockBroadcast1).not.toHaveBeenCalled();
      expect(mockBroadcast2).toHaveBeenCalled();
    });
  });

  describe('getAllMessages', () => {
    it('should return empty array for new session', () => {
      const messages = chatService.getAllMessages();

      expect(messages).toEqual([]);
    });

    it('should return all messages in current session', () => {
      chatService.addUserMessage('Hello');

      const messages = chatService.getAllMessages();

      expect(messages.length).toBe(1);
      expect(messages[0]?.text).toBe('Hello');
      expect(messages[0]?.sender).toBe('user');
    });
  });

  describe('addUserMessage', () => {
    it('should add user message to session', () => {
      const message = chatService.addUserMessage('Test message');

      expect(message).toHaveProperty('id');
      expect(message.text).toBe('Test message');
      expect(message.sender).toBe('user');
      expect(message.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include sessionId on user message', () => {
      const session = chatService.getCurrentSession();
      const message = chatService.addUserMessage('Test message');

      expect(message.sessionId).toBe(session.sessionId);
    });

    it('should generate unique message IDs', () => {
      const message1 = chatService.addUserMessage('First message');
      const message2 = chatService.addUserMessage('Second message');

      expect(message1.id).not.toBe(message2.id);
    });

    it('should set agent typing to true after user message', () => {
      chatService.addUserMessage('Hello');

      expect(chatService.isAgentTyping()).toBe(true);
    });

    it('should add message to messages array', () => {
      chatService.addUserMessage('Hello');

      const messages = chatService.getAllMessages();

      expect(messages.length).toBe(1);
      expect(messages[0]?.sender).toBe('user');
    });
  });

  describe('isAgentTyping', () => {
    it('should return false initially', () => {
      expect(chatService.isAgentTyping()).toBe(false);
    });

    it('should return true after user sends message', () => {
      chatService.addUserMessage('Hello');

      expect(chatService.isAgentTyping()).toBe(true);
    });

    it('should return false after agent responds', async () => {
      chatService.addUserMessage('Hello');

      // Wait for agent response (allow time for async agent call to complete)
      await flushPromises();

      expect(chatService.isAgentTyping()).toBe(false);
    });

    it('should remain false after agent responds and user has not sent new message', async () => {
      // User sends first message
      chatService.addUserMessage('Hello');

      // Wait for agent to respond (allow time for async agent call to complete)
      await flushPromises();

      // Verify typing is false after agent responds
      expect(chatService.isAgentTyping()).toBe(false);

      // Verify agent has responded (should have 3 messages: user + system (no docs) + agent)
      const messages = chatService.getAllMessages();
      expect(messages.length).toBe(3);
      expect(messages[2]?.sender).toBe('agent');

      // Wait more time to ensure typing stays false (user hasn't responded yet)
      await flushPromises();

      // Verify typing is still false
      expect(chatService.isAgentTyping()).toBe(false);
    });
  });

  describe('startNewSession', () => {
    it('should create new session with unique session ID', () => {
      const session = chatService.startNewSession();

      expect(session).toHaveProperty('sessionId');
      expect(session.sessionId).toMatch(/^session-\d+-\d+$/);
      expect(session.messages).toEqual([]);
      expect(session.isAgentTyping).toBe(false);
      expect(session.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should clear all messages from previous session', () => {
      chatService.addUserMessage('Message 1');
      chatService.addUserMessage('Message 2');

      expect(chatService.getAllMessages().length).toBeGreaterThan(0);

      chatService.startNewSession();

      expect(chatService.getAllMessages()).toEqual([]);
    });

    it('should reset agent typing status', () => {
      chatService.addUserMessage('Hello');
      expect(chatService.isAgentTyping()).toBe(true);

      chatService.startNewSession();

      expect(chatService.isAgentTyping()).toBe(false);
    });

    it('should generate different session IDs', () => {
      const session1 = chatService.startNewSession();
      const session2 = chatService.startNewSession();

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });
  });

  describe('getInitializationStatus', () => {
    it('should return initialization status with all expected fields', async () => {
      await flushPromises();

      const status = chatService.getInitializationStatus();

      expect(status).toMatchObject({
        agentReady: expect.any(Boolean),
        vectorStoreReady: expect.any(Boolean),
        isInitializing: expect.any(Boolean),
      });
    });

    it('should report agentReady true after successful initialization', async () => {
      await flushPromises();

      const status = chatService.getInitializationStatus();

      expect(status.agentReady).toBe(true);
      expect(status.isInitializing).toBe(false);
    });
  });

  describe('getCurrentSession', () => {
    it('should return current session data', () => {
      const session = chatService.getCurrentSession();

      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('messages');
      expect(session).toHaveProperty('isAgentTyping');
      expect(session).toHaveProperty('createdAt');
    });

    it('should return copy of messages array', () => {
      chatService.addUserMessage('Test');

      const session = chatService.getCurrentSession();
      const messages = chatService.getAllMessages();

      expect(session.messages).toEqual(messages);
      expect(session.messages).not.toBe(messages); // Different array references
    });
  });

  describe('Agent response generation', () => {
    it('should respond to greeting messages', async () => {
      chatService.addUserMessage('Hello');

      // Wait for agent response (allow time for async agent call to complete)
      await flushPromises();

      const messages = chatService.getAllMessages();
      const agentMessage = messages.find((m) => m.sender === 'agent');

      expect(agentMessage).toBeDefined();
      expect(agentMessage?.text).toContain('Hello');
    });

    it('should respond to help requests', async () => {
      chatService.addUserMessage('I need help');

      // Wait for agent response (allow time for async agent call to complete)
      await flushPromises();

      const messages = chatService.getAllMessages();
      const agentMessage = messages.find((m) => m.sender === 'agent');

      expect(agentMessage).toBeDefined();
      expect(agentMessage?.text).toContain('help');
    });

    it('should respond to file-related questions', async () => {
      chatService.addUserMessage('How do I upload a file?');

      // Wait for agent response (allow time for async agent call to complete)
      await flushPromises();

      const messages = chatService.getAllMessages();
      const agentMessage = messages.find((m) => m.sender === 'agent');

      expect(agentMessage).toBeDefined();
      expect(agentMessage?.text).toContain('upload');
    });

    it('should provide default response for unknown messages', async () => {
      chatService.addUserMessage('Random message');

      // Wait for agent response (allow time for async agent call to complete)
      await flushPromises();

      const messages = chatService.getAllMessages();
      const agentMessage = messages.find((m) => m.sender === 'agent');

      expect(agentMessage).toBeDefined();
      expect(agentMessage?.text.length).toBeGreaterThan(0);
    });

    it('should send error agent message when agent.chat throws', async () => {
      const { FinanceAgent } = require('../../agent/index.js');
      (FinanceAgent as jest.Mock).mockImplementationOnce(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        chat: jest.fn().mockRejectedValue(new Error('LLM service unavailable')),
      }));

      const service = new ChatService();
      await flushPromises();

      service.addUserMessage('Hello');
      await flushPromises();

      const messages = service.getAllMessages();
      const agentMsg = messages.find((m) => m.sender === 'agent');
      expect(agentMsg?.text).toContain('error');
    });
  });

  describe('Message ordering', () => {
    it('should maintain message order', () => {
      chatService.addUserMessage('First');
      chatService.addUserMessage('Second');
      chatService.addUserMessage('Third');

      const messages = chatService.getAllMessages();

      expect(messages[0]?.text).toBe('First');
      expect(messages[1]?.text).toBe('Second');
      expect(messages[2]?.text).toBe('Third');
    });
  });

  describe('addFileUploadedMessage', () => {
    it('should add a system message with file-added type', () => {
      chatService.addFileUploadedMessage('report.pdf');

      const messages = chatService.getAllMessages();
      const msg = messages.find((m) => m.sender === 'system');

      expect(msg).toBeDefined();
      expect(msg?.text).toBe('Document added: report.pdf');
      expect(msg?.metadata?.type).toBe('file-added');
      expect(msg?.metadata?.fileName).toBe('report.pdf');
    });

    it('should broadcast systemMessage event for file upload', () => {
      const mockBroadcast = jest.fn();
      chatService.setBroadcastCallback(mockBroadcast);

      chatService.addFileUploadedMessage('data.csv');

      expect(mockBroadcast).toHaveBeenCalledWith('systemMessage', expect.objectContaining({
        text: 'Document added: data.csv',
        sender: 'system',
      }));
    });

    it('should include sessionId on the system message', () => {
      const session = chatService.getCurrentSession();
      chatService.addFileUploadedMessage('test.txt');

      const messages = chatService.getAllMessages();
      const msg = messages.find((m) => m.sender === 'system');

      expect(msg?.sessionId).toBe(session.sessionId);
    });
  });

  describe('addFileDeletedMessage', () => {
    it('should add a system message with file-deleted type', () => {
      chatService.addFileDeletedMessage('old-report.pdf');

      const messages = chatService.getAllMessages();
      const msg = messages.find((m) => m.sender === 'system');

      expect(msg).toBeDefined();
      expect(msg?.text).toBe('Document removed: old-report.pdf');
      expect(msg?.metadata?.type).toBe('file-deleted');
      expect(msg?.metadata?.fileName).toBe('old-report.pdf');
    });

    it('should broadcast systemMessage event for file deletion', () => {
      const mockBroadcast = jest.fn();
      chatService.setBroadcastCallback(mockBroadcast);

      chatService.addFileDeletedMessage('data.csv');

      expect(mockBroadcast).toHaveBeenCalledWith('systemMessage', expect.objectContaining({
        text: 'Document removed: data.csv',
        sender: 'system',
      }));
    });
  });
});
