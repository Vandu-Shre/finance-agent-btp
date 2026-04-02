import { ChatService } from '../../services/chat.service.js';
import { FinanceAgent, initializeVectorStore, indexDocumentFromBuffer, searchDocuments } from '../../agent/index.js';

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

// Mock the agent package
jest.mock('../../agent/index.js', () => ({
  FinanceAgent: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    chat: jest.fn().mockResolvedValue('Mocked agent response'),
  })),
  initializeVectorStore: jest.fn().mockResolvedValue(undefined),
  indexDocumentFromBuffer: jest.fn().mockResolvedValue(undefined),
  searchDocuments: jest.fn().mockResolvedValue([]),
}));

const flushPromises = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

describe('ChatService - Vector Store Integration', () => {
  let chatService: ChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    chatService = new ChatService();
  });

  describe('Vector Store Initialization', () => {
    it('should initialize vector store on service creation', async () => {
      // Wait for async initialization
      await flushPromises();

      expect(initializeVectorStore).toHaveBeenCalled();
    });

    it('should set vectorStoreInitialized to true after successful initialization', async () => {
      // Wait for async initialization
      await flushPromises();

      expect(chatService.isVectorStoreReady()).toBe(true);
    });

    it('should handle vector store initialization failure gracefully', async () => {
      (initializeVectorStore as jest.Mock).mockRejectedValueOnce(
        new Error('Vector store initialization failed')
      );

      const service = new ChatService();

      // Wait for async initialization
      await flushPromises();

      expect(service.isVectorStoreReady()).toBe(false);
    });
  });

  describe('indexDocument', () => {
    beforeEach(async () => {
      // Wait for initialization
      await flushPromises();
    });

    it('should index document successfully', async () => {
      const buffer = Buffer.from('Test document content');
      const filename = 'test.txt';
      const mimetype = 'text/plain';

      await chatService.indexDocument(buffer, filename, mimetype, 'test-user');

      expect(indexDocumentFromBuffer).toHaveBeenCalledWith(buffer, filename, mimetype, 'test-user');
    });

    it('should throw error if vector store not initialized', async () => {
      (initializeVectorStore as jest.Mock).mockRejectedValueOnce(new Error('Init failed'));

      const service = new ChatService();
      await flushPromises();

      const buffer = Buffer.from('Test content');

      await expect(
        service.indexDocument(buffer, 'test.txt', 'text/plain', 'test-user')
      ).rejects.toThrow('Vector store not initialized');
    });

    it('should propagate indexing errors', async () => {
      (indexDocumentFromBuffer as jest.Mock).mockRejectedValueOnce(
        new Error('Indexing failed')
      );

      const buffer = Buffer.from('Test content');

      await expect(
        chatService.indexDocument(buffer, 'test.txt', 'text/plain', 'test-user')
      ).rejects.toThrow('Indexing failed');
    });

    it('should handle different file types', async () => {
      const testCases = [
        { mimetype: 'text/plain', filename: 'test.txt' },
        { mimetype: 'text/csv', filename: 'test.csv' },
        { mimetype: 'application/json', filename: 'test.json' },
        { mimetype: 'application/pdf', filename: 'test.pdf' },
      ];

      for (const testCase of testCases) {
        const buffer = Buffer.from('Test content');

        await chatService.indexDocument(buffer, testCase.filename, testCase.mimetype, 'test-user');

        expect(indexDocumentFromBuffer).toHaveBeenCalledWith(
          buffer,
          testCase.filename,
          testCase.mimetype,
          'test-user'
        );
      }
    });

    it('should handle empty buffers', async () => {
      const buffer = Buffer.from('');
      const filename = 'empty.txt';
      const mimetype = 'text/plain';

      await chatService.indexDocument(buffer, filename, mimetype, 'test-user');

      expect(indexDocumentFromBuffer).toHaveBeenCalledWith(buffer, filename, mimetype, 'test-user');
    });

    it('should handle large buffers', async () => {
      const largeContent = 'a'.repeat(10 * 1024 * 1024); // 10MB
      const buffer = Buffer.from(largeContent);
      const filename = 'large.txt';
      const mimetype = 'text/plain';

      await chatService.indexDocument(buffer, filename, mimetype, 'test-user');

      expect(indexDocumentFromBuffer).toHaveBeenCalledWith(buffer, filename, mimetype, 'test-user');
    });
  });

  describe('isVectorStoreReady', () => {
    it('should return true when vector store is initialized', async () => {
      await flushPromises();

      expect(chatService.isVectorStoreReady()).toBe(true);
    });

    it('should return false when vector store initialization fails', async () => {
      (initializeVectorStore as jest.Mock).mockRejectedValueOnce(new Error('Failed'));

      const service = new ChatService();
      await flushPromises();

      expect(service.isVectorStoreReady()).toBe(false);
    });
  });

  describe('searchDocuments - error path', () => {
    beforeEach(async () => {
      await flushPromises();
    });

    it('should still respond when searchDocuments throws', async () => {
      (searchDocuments as jest.Mock).mockRejectedValueOnce(new Error('Search failed'));

      chatService.addUserMessage('What happened?');
      await flushPromises();

      const messages = chatService.getAllMessages();
      const agentMsg = messages.find((m) => m.sender === 'agent');
      expect(agentMsg).toBeDefined();
    });
  });

  describe('searchDocuments - docs found path', () => {
    beforeEach(async () => {
      await flushPromises();
    });

    it('should add system message with doc count when documents are found', async () => {
      (searchDocuments as jest.Mock).mockResolvedValueOnce([
        { pageContent: 'Revenue was $5M', metadata: { source: 'report.pdf' } },
        { pageContent: 'Costs were $3M', metadata: { source: 'report.pdf' } },
      ]);

      chatService.addUserMessage('What is the revenue?');
      await flushPromises();

      const messages = chatService.getAllMessages();
      const systemMsg = messages.find(
        (m) => m.sender === 'system' && m.text.includes('Found 2 relevant document')
      );
      expect(systemMsg).toBeDefined();
      expect(systemMsg?.metadata?.fileCount).toBe(2);
    });

    it('should broadcast systemMessage when documents are found', async () => {
      (searchDocuments as jest.Mock).mockResolvedValueOnce([
        { pageContent: 'Q1 profit was $1M', metadata: { source: 'q1.pdf' } },
      ]);

      const mockBroadcast = jest.fn();
      chatService.setBroadcastCallback(mockBroadcast);

      chatService.addUserMessage('Profit?');
      await flushPromises();

      expect(mockBroadcast).toHaveBeenCalledWith(
        'systemMessage',
        expect.objectContaining({ text: expect.stringContaining('Found 1 relevant document') })
      );
    });
  });

  describe('Integration with existing chat functionality', () => {
    beforeEach(async () => {
      await flushPromises();
    });

    it('should not affect existing chat functionality', () => {
      const message = chatService.addUserMessage('Hello');

      expect(message).toMatchObject({
        id: expect.any(String),
        text: 'Hello',
        sender: 'user',
        timestamp: expect.any(String),
      });
    });

    it('should initialize agent even if vector store fails', async () => {
      (initializeVectorStore as jest.Mock).mockRejectedValueOnce(
        new Error('Vector store failed')
      );

      const service = new ChatService();
      await flushPromises();

      // Chat should still work even if vector store failed
      const message = service.addUserMessage('Test message');
      expect(message.text).toBe('Test message');
    });
  });
});
