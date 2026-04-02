import { FinanceAgent, initializeVectorStore, indexDocumentFromBuffer, searchDocuments } from '../agent/index.js';
import { prisma } from './db.service.js';

export interface Message {
  id: string;
  sessionId: string;
  text: string;
  sender: 'user' | 'agent' | 'system';
  timestamp: string;
  metadata?: {
    type?: 'file-added' | 'file-deleted' | 'files-loaded';
    fileName?: string;
    fileCount?: number;
  };
}

export interface ChatSession {
  sessionId: string;
  messages: Message[];
  isAgentTyping: boolean;
  createdAt: string;
}

export type BroadcastCallback = (event: string, data: any) => void;

export class ChatService {
  private currentSession: ChatSession;
  private broadcastCallback: BroadcastCallback | null = null;
  private agent: FinanceAgent | null = null;
  private isInitializing: boolean = false;
  private vectorStoreInitialized: boolean = false;

  constructor() {
    this.currentSession = this.createNewSession();
    this.initializeAgent();
  }

  private async initializeAgent(): Promise<void> {
    if (this.isInitializing || this.agent) return;

    this.isInitializing = true;
    try {
      // Initialize the agent
      console.log('🔄 Initializing Finance Agent...');
      this.agent = new FinanceAgent();
      await this.agent.initialize();
      console.log('✅ Finance Agent initialized successfully');

      // Initialize vector store
      console.log('🔄 Initializing Vector Store...');
      await initializeVectorStore();
      this.vectorStoreInitialized = true;
      console.log('✅ Vector store initialized successfully');

      // Load existing files into chat history
      await this.loadExistingFiles();
    } catch (error) {
      console.error('❌ Failed to initialize Finance Agent or Vector Store:', error);
      console.error('Error details:', error instanceof Error ? error.message : error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
      this.agent = null;
      this.vectorStoreInitialized = false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Index a document in the vector store
   */
  async indexDocument(buffer: Buffer, filename: string, mimetype: string, userId: string): Promise<void> {
    // Wait for initialization if still in progress
    if (this.isInitializing) {
      console.log('⏳ Waiting for vector store initialization...');
      // Wait up to 30 seconds for initialization
      const maxWait = 30000;
      const startTime = Date.now();
      while (this.isInitializing && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (!this.vectorStoreInitialized) {
      throw new Error('Vector store not initialized. Please check server logs for initialization errors.');
    }

    try {
      await indexDocumentFromBuffer(buffer, filename, mimetype, userId);
      console.log(`✅ Document indexed: ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to index document ${filename}:`, error);
      throw error;
    }
  }

  isVectorStoreReady(): boolean {
    return this.vectorStoreInitialized;
  }

  /**
   * Get initialization status
   */
  getInitializationStatus(): {
    agentReady: boolean;
    vectorStoreReady: boolean;
    isInitializing: boolean;
  } {
    return {
      agentReady: this.agent !== null,
      vectorStoreReady: this.vectorStoreInitialized,
      isInitializing: this.isInitializing,
    };
  }

  // Set broadcast callback (used by routes to broadcast to WS clients)
  setBroadcastCallback(callback: BroadcastCallback): void {
    this.broadcastCallback = callback;
  }

  private broadcast(event: string, data: any): void {
    if (this.broadcastCallback) {
      this.broadcastCallback(event, data);
    }
  }

  private createNewSession(): ChatSession {
    const sessionId = this.generateSessionId();
    const createdAt = new Date().toISOString();
    prisma.session.create({ data: { id: sessionId, createdAt: new Date(createdAt) } })
      .catch((err: Error) => console.error('DB persist session failed:', err.message));
    return { sessionId, messages: [], isAgentTyping: false, createdAt };
  }

  private persistMessage(message: Message): void {
    prisma.message.create({
      data: {
        id: message.id,
        sessionId: message.sessionId,
        text: message.text,
        sender: message.sender,
        timestamp: new Date(message.timestamp),
        metadata: message.metadata ? JSON.stringify(message.metadata) : null,
      },
    }).catch((err: Error) => console.error('DB persist message failed:', err.message));
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  }

  getAllMessages(): Message[] {
    return this.currentSession.messages;
  }

  addUserMessage(text: string): Message {
    console.log(`addUserMessage called: "${text}"`);
    const message: Message = {
      id: this.generateMessageId(),
      sessionId: this.currentSession.sessionId,
      text,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    this.currentSession.messages.push(message);
    this.persistMessage(message);
    console.log(`User message added to session, total messages: ${this.currentSession.messages.length}`);

    // Broadcast user message
    this.broadcast('userMessage', message);

    // Start agent typing
    this.currentSession.isAgentTyping = true;
    this.broadcast('typingStart', { isTyping: true });

    // Get agent response immediately (without artificial delay)
    this.addAgentResponse(text, this.currentSession.sessionId);

    return message;
  }

  private sendAgentMessage(text: string): void {
    const message: Message = {
      id: this.generateMessageId(),
      sessionId: this.currentSession.sessionId,
      text,
      sender: 'agent',
      timestamp: new Date().toISOString(),
    };
    this.currentSession.messages.push(message);
    this.persistMessage(message);
    this.currentSession.isAgentTyping = false;
    this.broadcast('agentMessage', message);
    this.broadcast('typingStop', { isTyping: false });
  }

  private async retrieveContext(userMessage: string, userId: string): Promise<string> {
    if (!this.vectorStoreInitialized) {
      console.log('⚠️ Vector store not initialized');
      return '';
    }
    try {
      const docs = await searchDocuments(userMessage, 4, userId);
      if (docs && docs.length > 0) {
        console.log(`✅ Retrieved ${docs.length} relevant documents for context`);
        const context = docs.map((doc, i) =>
          `Document ${i + 1} (Source: ${doc.metadata?.source ?? 'Unknown source'}):\n${doc.pageContent}`
        ).join('\n\n---\n\n');
        const msg: Message = {
          id: this.generateMessageId(),
          sessionId: this.currentSession.sessionId,
          text: `Found ${docs.length} relevant document chunk${docs.length > 1 ? 's' : ''} to answer your question`,
          sender: 'system',
          timestamp: new Date().toISOString(),
          metadata: { type: 'file-added', fileCount: docs.length },
        };
        this.currentSession.messages.push(msg);
        this.persistMessage(msg);
        this.broadcast('systemMessage', msg);
        return context;
      }
      console.log('⚠️ No relevant documents found in vector store');
      const noDocsMsg: Message = {
        id: this.generateMessageId(),
        sessionId: this.currentSession.sessionId,
        text: 'No relevant documents found for this question',
        sender: 'system',
        timestamp: new Date().toISOString(),
        metadata: { type: 'file-deleted' },
      };
      this.currentSession.messages.push(noDocsMsg);
      this.persistMessage(noDocsMsg);
      this.broadcast('systemMessage', noDocsMsg);
      return '';
    } catch (error) {
      console.error('❌ Error retrieving documents from vector store:', error);
      return '';
    }
  }

  private async addAgentResponse(userMessage: string, userId: string): Promise<void> {
    try {
      if (!this.agent) {
        this.sendAgentMessage(
          'Sorry, the AI agent is not initialized. Please check the server configuration and ensure OPENAI_API_KEY is set in the .env file.'
        );
        return;
      }
      const context = await this.retrieveContext(userMessage, userId);
      const responseText = await this.agent.chat(userMessage, context);
      this.sendAgentMessage(responseText);
    } catch (error) {
      console.error('Error getting agent response:', error);
      this.sendAgentMessage('Sorry, I encountered an error processing your message. Please try again.');
    }
  }

  isAgentTyping(): boolean {
    return this.currentSession.isAgentTyping;
  }

  startNewSession(): ChatSession {
    this.currentSession = this.createNewSession();

    // Broadcast session reset
    this.broadcast('sessionReset', {
      sessionId: this.currentSession.sessionId,
      createdAt: this.currentSession.createdAt
    });

    // Load and display existing files
    this.loadExistingFiles();

    return {
      sessionId: this.currentSession.sessionId,
      messages: this.currentSession.messages,
      isAgentTyping: false,
      createdAt: this.currentSession.createdAt,
    };
  }

  /**
   * Load existing files and add system message
   */
  private async loadExistingFiles(): Promise<void> {
    try {
      const { default: fileService } = await import('./file.service.js');
      const files = await fileService.getAllFiles();

      if (files.length > 0) {
        const fileNames = files.map(f => f.fileName).join(', ');
        const systemMessage: Message = {
          id: this.generateMessageId(),
          sessionId: this.currentSession.sessionId,
          text: `${files.length} document${files.length > 1 ? 's' : ''} loaded: ${fileNames}`,
          sender: 'system',
          timestamp: new Date().toISOString(),
          metadata: {
            type: 'files-loaded',
            fileCount: files.length
          }
        };

        this.currentSession.messages.push(systemMessage);
        this.broadcast('systemMessage', systemMessage);
        console.log(`✅ Loaded ${files.length} existing file(s) for new session`);
      }
    } catch (error) {
      console.error('Error loading existing files:', error);
    }
  }

  /**
   * Add system message for file upload
   */
  addFileUploadedMessage(fileName: string): void {
    const systemMessage: Message = {
      id: this.generateMessageId(),
      sessionId: this.currentSession.sessionId,
      text: `Document added: ${fileName}`,
      sender: 'system',
      timestamp: new Date().toISOString(),
      metadata: {
        type: 'file-added',
        fileName
      }
    };

    this.currentSession.messages.push(systemMessage);
    this.persistMessage(systemMessage);
    this.broadcast('systemMessage', systemMessage);
    console.log(`📄 File uploaded message added: ${fileName}`);
  }

  /**
   * Add system message for file deletion
   */
  addFileDeletedMessage(fileName: string): void {
    const systemMessage: Message = {
      id: this.generateMessageId(),
      sessionId: this.currentSession.sessionId,
      text: `Document removed: ${fileName}`,
      sender: 'system',
      timestamp: new Date().toISOString(),
      metadata: {
        type: 'file-deleted',
        fileName
      }
    };

    this.currentSession.messages.push(systemMessage);
    this.persistMessage(systemMessage);
    this.broadcast('systemMessage', systemMessage);
    console.log(`🗑️ File deleted message added: ${fileName}`);
  }

  getCurrentSession(): ChatSession {
    return {
      ...this.currentSession,
      messages: [...this.currentSession.messages],
    };
  }
}

const chatService = new ChatService();
export default chatService;
