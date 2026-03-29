// API calls use relative URLs - requests are proxied through approuter
const API_BASE_URL = '/api';

// WebSocket URL - automatically detect protocol and use current host
const getWebSocketUrl = (): string => {
  // In production (Cloud Foundry), use current host and wss protocol
  // In development, use localhost
  if (window.location.hostname === 'localhost') {
    return 'ws://localhost:5001/api';
  }

  // Production: use wss:// with current hostname
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api`;
};

const WS_BASE_URL = getWebSocketUrl();

export type FileInfo = {
  fileName: string;
  storedName: string;
  type: string;
  size: string;
  uploadDate: string;
  path?: string;
};

export type Message = {
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
};

// File API
export const fileApi = {
  async uploadFile(file: File): Promise<{ message: string; file: FileInfo }> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (chatApi.sessionId) {
      headers['X-Session-ID'] = chatApi.sessionId;
    }

    const response = await fetch(`${API_BASE_URL}/files`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload file');
    }

    return response.json();
  },

  async getAllFiles(): Promise<{ files: FileInfo[] }> {
    const response = await fetch(`${API_BASE_URL}/files`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get files');
    }

    return response.json();
  },

  async deleteFile(filename: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/files/${filename}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete file');
    }

    return response.json();
  },
};

// Chat API with WebSocket-only communication
export const chatApi = {
  // Store WebSocket connection
  ws: null as WebSocket | null,

  // Current session ID — updated on connect and new session
  sessionId: null as string | null,

  // Create WebSocket connection for real-time updates
  createWebSocket(
    onUserMessage: (message: Message) => void,
    onAgentMessage: (message: Message) => void,
    onTypingStart: () => void,
    onTypingStop: () => void,
    onSessionReset: () => void,
    onConnected: (session: any) => void,
    onError: (error: Event) => void,
    onSystemMessage?: (message: Message) => void,
    onNewSession?: (sessionId: string) => void
  ): WebSocket {
    // Use approuter URL for WebSocket - changed from /chat/stream to /chat
    const wsUrl = `${WS_BASE_URL}/chat`;
    console.log('Creating WebSocket connection to:', wsUrl);
    console.log('Window location:', window.location.href);
    console.log('Detected WS_BASE_URL:', WS_BASE_URL);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connection opened');
      this.ws = ws; // Set reference after connection is open
    };

    ws.onmessage = (event) => {
      try {
        const { event: eventType, data } = JSON.parse(event.data);
        console.log('WebSocket message received:', eventType, data);

        switch (eventType) {
          case 'connected':
            console.log('WebSocket connected:', data);
            chatApi.sessionId = data.session?.sessionId ?? null;
            onConnected(data.session);
            break;
          case 'userMessage':
            onUserMessage(data);
            break;
          case 'agentMessage':
            onAgentMessage(data);
            break;
          case 'systemMessage':
            if (onSystemMessage) {
              onSystemMessage(data);
            }
            break;
          case 'typingStart':
            onTypingStart();
            break;
          case 'typingStop':
            onTypingStop();
            break;
          case 'sessionReset':
            onSessionReset();
            break;
          case 'messagesList':
            // Handle messagesList response if needed
            console.log('Received messages list:', data.messages);
            break;
          case 'newSession':
            console.log('New session created:', data);
            chatApi.sessionId = data.session?.sessionId ?? null;
            if (onNewSession && data.session?.sessionId) {
              onNewSession(data.session.sessionId);
            }
            break;
          case 'error':
            console.error('WebSocket error event:', data.error);
            break;
          default:
            console.warn('Unknown WebSocket event:', eventType);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError(error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      this.ws = null;
    };

    return ws;
  },

  // Send message via WebSocket
  sendMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket state:', this.ws?.readyState);
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({
      action: 'sendMessage',
      text
    }));
  },

  // Get all messages via WebSocket
  getAllMessages(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({
      action: 'getMessages'
    }));
  },

  // Get typing status via WebSocket
  getTypingStatus(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({
      action: 'getTypingStatus'
    }));
  },

  // Start new session via WebSocket
  startNewSession(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({
      action: 'startNewSession'
    }));
  },
};
