/**
 * File information returned by the API
 */
export interface FileInfo {
  fileName: string;
  storedName: string;
  type: string;
  size: string;
  uploadDate: string;
  path?: string;
}

/**
 * Chat message structure
 */
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  timestamp: string;
}

/**
 * Session information
 */
export interface Session {
  sessionId: string;
  createdAt: string;
}

/**
 * WebSocket event types
 */
export type WebSocketEvent =
  | 'connected'
  | 'userMessage'
  | 'agentMessage'
  | 'typingStart'
  | 'typingStop'
  | 'sessionReset'
  | 'messagesList'
  | 'newSession'
  | 'error';

/**
 * WebSocket action types
 */
export type WebSocketAction =
  | 'sendMessage'
  | 'getMessages'
  | 'getTypingStatus'
  | 'startNewSession';

/**
 * Configuration options for the SDK
 */
export interface FinanceAgentConfig {
  /**
   * Base URL of the Finance Agent API
   * @example 'https://your-app.cfapps.eu10.hana.ondemand.com'
   */
  baseUrl: string;

  /**
   * XSUAA JWT Bearer token for authenticated requests.
   * Obtain via client credentials flow or user token exchange against your
   * XSUAA service instance token URL.
   * When provided, sent as `Authorization: Bearer <token>` on all requests.
   */
  authToken?: string;

  /**
   * Optional custom headers
   */
  headers?: Record<string, string>;
}

/**
 * File upload response
 */
export interface UploadFileResponse {
  message: string;
  file: FileInfo;
}

/**
 * File list response
 */
export interface GetFilesResponse {
  files: FileInfo[];
}

/**
 * Delete file response
 */
export interface DeleteFileResponse {
  message: string;
}

/**
 * WebSocket event handlers
 */
export interface ChatEventHandlers {
  onConnected?: (session: Session) => void;
  onUserMessage?: (message: Message) => void;
  onAgentMessage?: (message: Message) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  onSessionReset?: () => void;
  onError?: (error: string) => void;
}
