import WebSocket from 'ws';
import type {
  Message,
  Session,
  ChatEventHandlers,
  FinanceAgentConfig,
  WebSocketEvent,
} from './types.js';

/**
 * Chat API Client
 * Handles WebSocket-based chat communication
 */
export class ChatClient {
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private handlers: ChatEventHandlers = {};
  private authToken?: string;

  constructor(config: FinanceAgentConfig) {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    // Convert http(s) to ws(s)
    this.wsUrl = baseUrl.replace(/^http/, 'ws') + '/api/chat';
    this.authToken = config.authToken;
  }

  /**
   * Connect to the chat WebSocket
   * @param handlers - Event handlers for WebSocket events
   */
  connect(handlers: ChatEventHandlers = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      this.handlers = handlers;

      const headers: Record<string, string> = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      this.ws = new WebSocket(this.wsUrl, { headers });

      this.ws.on('open', () => {
        console.log('WebSocket connected');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message.event, message.data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        if (this.handlers.onError) {
          this.handlers.onError(error.message);
        }
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('WebSocket disconnected');
        this.ws = null;
      });
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(event: WebSocketEvent, data: any): void {
    switch (event) {
      case 'connected':
        if (this.handlers.onConnected) {
          this.handlers.onConnected(data.session);
        }
        break;
      case 'userMessage':
        if (this.handlers.onUserMessage) {
          this.handlers.onUserMessage(data);
        }
        break;
      case 'agentMessage':
        if (this.handlers.onAgentMessage) {
          this.handlers.onAgentMessage(data);
        }
        break;
      case 'typingStart':
        if (this.handlers.onTypingStart) {
          this.handlers.onTypingStart();
        }
        break;
      case 'typingStop':
        if (this.handlers.onTypingStop) {
          this.handlers.onTypingStop();
        }
        break;
      case 'sessionReset':
        if (this.handlers.onSessionReset) {
          this.handlers.onSessionReset();
        }
        break;
      case 'messagesList':
        // Could add a handler for this if needed
        console.log('Received messages list:', data.messages);
        break;
      case 'newSession':
        console.log('New session created:', data);
        break;
      case 'error':
        if (this.handlers.onError) {
          this.handlers.onError(data.error);
        }
        break;
      default:
        console.warn('Unknown WebSocket event:', event);
    }
  }

  /**
   * Send a chat message
   * @param text - Message text to send
   */
  sendMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(
      JSON.stringify({
        action: 'sendMessage',
        text,
      })
    );
  }

  /**
   * Request all messages from the server
   */
  getMessages(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(
      JSON.stringify({
        action: 'getMessages',
      })
    );
  }

  /**
   * Get current typing status
   */
  getTypingStatus(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(
      JSON.stringify({
        action: 'getTypingStatus',
      })
    );
  }

  /**
   * Start a new chat session
   */
  startNewSession(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(
      JSON.stringify({
        action: 'startNewSession',
      })
    );
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
