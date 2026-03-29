import { ChatClient } from '../chat-client.js';
import type { FinanceAgentConfig, ChatEventHandlers } from '../types.js';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');
const MockedWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

describe('ChatClient', () => {
  let chatClient: ChatClient;
  let mockWs: jest.Mocked<WebSocket>;
  const config: FinanceAgentConfig = {
    baseUrl: 'https://test-app.cfapps.example.com',
    authToken: 'test-token',
  };

  beforeEach(() => {
    mockWs = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
    } as any;

    MockedWebSocket.mockImplementation(() => mockWs);
    chatClient = new ChatClient(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should convert https to wss', () => {
      const client = new ChatClient({
        baseUrl: 'https://example.com',
      });
      expect(client).toBeInstanceOf(ChatClient);
    });

    it('should convert http to ws', () => {
      const client = new ChatClient({
        baseUrl: 'http://example.com',
      });
      expect(client).toBeInstanceOf(ChatClient);
    });
  });

  describe('connect', () => {
    it('should establish WebSocket connection', async () => {
      const handlers: ChatEventHandlers = {
        onConnected: jest.fn(),
        onAgentMessage: jest.fn(),
      };

      const connectPromise = chatClient.connect(handlers);

      // Simulate WebSocket open event
      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openHandler) {
        (openHandler as Function)();
      }

      await connectPromise;

      expect(MockedWebSocket).toHaveBeenCalledWith(
        'wss://test-app.cfapps.example.com/api/chat',
        {
          headers: {
            Authorization: 'Bearer test-token',
          },
        }
      );
    });

    it('should handle connection events', async () => {
      const handlers: ChatEventHandlers = {
        onConnected: jest.fn(),
      };

      const connectPromise = chatClient.connect(handlers);

      // Trigger open event
      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openHandler) {
        (openHandler as Function)();
      }

      await connectPromise;

      // Trigger message event with connected event
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        const message = JSON.stringify({
          event: 'connected',
          data: {
            session: {
              sessionId: 'test-session',
              createdAt: '2024-03-28',
            },
          },
        });
        (messageHandler as Function)(Buffer.from(message));
      }

      expect(handlers.onConnected).toHaveBeenCalledWith({
        sessionId: 'test-session',
        createdAt: '2024-03-28',
      });
    });

    it('should handle connection errors', async () => {
      const handlers: ChatEventHandlers = {
        onError: jest.fn(),
      };

      const connectPromise = chatClient.connect(handlers);

      // Trigger error event
      const errorHandler = mockWs.on.mock.calls.find(call => call[0] === 'error')?.[1];
      if (errorHandler) {
        (errorHandler as Function)(new Error('Connection failed'));
      }

      await expect(connectPromise).rejects.toThrow('Connection failed');
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      const connectPromise = chatClient.connect();
      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openHandler) {
        (openHandler as Function)();
      }
      await connectPromise;
    });

    it('should send message via WebSocket', () => {
      chatClient.sendMessage('Hello');

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: 'sendMessage',
          text: 'Hello',
        })
      );
    });

    it('should throw error if not connected', () => {
      // Create a new mock with CLOSED state
      const closedMockWs = {
        ...mockWs,
        readyState: WebSocket.CLOSED,
      } as any;

      // Replace the internal ws reference
      (chatClient as any).ws = closedMockWs;

      expect(() => chatClient.sendMessage('Hello')).toThrow('WebSocket is not connected');
    });
  });

  describe('getMessages', () => {
    beforeEach(async () => {
      const connectPromise = chatClient.connect();
      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openHandler) {
        (openHandler as Function)();
      }
      await connectPromise;
    });

    it('should request all messages', () => {
      chatClient.getMessages();

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: 'getMessages',
        })
      );
    });
  });

  describe('startNewSession', () => {
    beforeEach(async () => {
      const connectPromise = chatClient.connect();
      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openHandler) {
        (openHandler as Function)();
      }
      await connectPromise;
    });

    it('should start new session', () => {
      chatClient.startNewSession();

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: 'startNewSession',
        })
      );
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      const connectPromise = chatClient.connect();
      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openHandler) {
        (openHandler as Function)();
      }
      await connectPromise;
    });

    it('should close WebSocket connection', () => {
      chatClient.disconnect();

      expect(mockWs.close).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', () => {
      chatClient.disconnect();
      chatClient.disconnect(); // Call again when already disconnected

      expect(mockWs.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(chatClient.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      const connectPromise = chatClient.connect();
      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openHandler) {
        (openHandler as Function)();
      }
      await connectPromise;

      expect(chatClient.isConnected()).toBe(true);
    });
  });

  describe('event handlers', () => {
    let handlers: ChatEventHandlers;

    beforeEach(async () => {
      handlers = {
        onUserMessage: jest.fn(),
        onAgentMessage: jest.fn(),
        onTypingStart: jest.fn(),
        onTypingStop: jest.fn(),
        onSessionReset: jest.fn(),
        onError: jest.fn(),
      };

      const connectPromise = chatClient.connect(handlers);
      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openHandler) {
        (openHandler as Function)();
      }
      await connectPromise;
    });

    it('should handle userMessage event', () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      const message = JSON.stringify({
        event: 'userMessage',
        data: { id: '1', text: 'Hello', sender: 'user', timestamp: '2024-03-28' },
      });

      if (messageHandler) {
        (messageHandler as Function)(Buffer.from(message));
      }

      expect(handlers.onUserMessage).toHaveBeenCalled();
    });

    it('should handle agentMessage event', () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      const message = JSON.stringify({
        event: 'agentMessage',
        data: { id: '2', text: 'Hi there', sender: 'agent', timestamp: '2024-03-28' },
      });

      if (messageHandler) {
        (messageHandler as Function)(Buffer.from(message));
      }

      expect(handlers.onAgentMessage).toHaveBeenCalled();
    });

    it('should handle typingStart event', () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      const message = JSON.stringify({
        event: 'typingStart',
        data: {},
      });

      if (messageHandler) {
        (messageHandler as Function)(Buffer.from(message));
      }

      expect(handlers.onTypingStart).toHaveBeenCalled();
    });

    it('should handle typingStop event', () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      const message = JSON.stringify({
        event: 'typingStop',
        data: {},
      });

      if (messageHandler) {
        (messageHandler as Function)(Buffer.from(message));
      }

      expect(handlers.onTypingStop).toHaveBeenCalled();
    });

    it('should handle sessionReset event', () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      const message = JSON.stringify({
        event: 'sessionReset',
        data: {},
      });

      if (messageHandler) {
        (messageHandler as Function)(Buffer.from(message));
      }

      expect(handlers.onSessionReset).toHaveBeenCalled();
    });

    it('should handle error event', () => {
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      const message = JSON.stringify({
        event: 'error',
        data: { error: 'Something went wrong' },
      });

      if (messageHandler) {
        (messageHandler as Function)(Buffer.from(message));
      }

      expect(handlers.onError).toHaveBeenCalledWith('Something went wrong');
    });
  });
});
