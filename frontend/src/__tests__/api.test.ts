/**
 * Tests for api.ts
 *
 * Covers:
 *  - fileApi  (fetch-based: uploadFile, getAllFiles, deleteFile)
 *  - chatApi  (WebSocket-based: createWebSocket message routing, sendMessage,
 *              getAllMessages, getTypingStatus, startNewSession)
 *  - WebSocket URL detection (localhost vs production HTTP/HTTPS)
 */

// ─── MockWebSocket ────────────────────────────────────────────────────────────

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  url: string;
  readyState: number;
  private _sent: string[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
  }

  send(data: string) { this._sent.push(data); }

  /** Returns sent frames deserialized as objects. */
  get sent(): object[] { return this._sent.map((s) => JSON.parse(s)); }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helpers
  emitOpen() { this.onopen?.(); }
  emitMessage(payload: object) { this.onmessage?.({ data: JSON.stringify(payload) }); }
  emitError(e: Event) { this.onerror?.(e); }
}

let lastWs: MockWebSocket | null = null;
const WsConstructor = jest.fn().mockImplementation((url: string) => {
  lastWs = new MockWebSocket(url);
  return lastWs;
});
(WsConstructor as any).OPEN = MockWebSocket.OPEN;
(WsConstructor as any).CLOSED = MockWebSocket.CLOSED;
(global as any).WebSocket = WsConstructor;

// ─── fetch mock ───────────────────────────────────────────────────────────────

const fetchMock = jest.fn();
global.fetch = fetchMock;

const okResponse = (body: object) => ({ ok: true, json: jest.fn().mockResolvedValue(body) });
const errResponse = (body: object) => ({ ok: false, json: jest.fn().mockResolvedValue(body) });

// ─── Imports ──────────────────────────────────────────────────────────────────

import { chatApi, fileApi, getWebSocketUrl, type FileInfo, type Message } from '../api';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const defaultCallbacks = () => ({
  onUserMessage: jest.fn<void, [Message]>(),
  onAgentMessage: jest.fn<void, [Message]>(),
  onTypingStart: jest.fn<void, []>(),
  onTypingStop: jest.fn<void, []>(),
  onSessionReset: jest.fn<void, []>(),
  onConnected: jest.fn<void, [any]>(),
  onError: jest.fn<void, [Event]>(),
  onSystemMessage: jest.fn<void, [Message]>(),
  onNewSession: jest.fn<void, [string]>(),
});

/** Creates a WS, fires onopen so chatApi.ws is populated, and returns the mock. */
function connectWs(): MockWebSocket {
  const cb = defaultCallbacks();
  chatApi.createWebSocket(
    cb.onUserMessage, cb.onAgentMessage, cb.onTypingStart, cb.onTypingStop,
    cb.onSessionReset, cb.onConnected, cb.onError,
  );
  lastWs!.emitOpen();
  return lastWs!;
}

beforeEach(() => {
  jest.clearAllMocks();
  lastWs = null;
  // Reset chatApi mutable singleton state between tests
  chatApi.ws = null;
  chatApi.sessionId = null;
});

// ─── fileApi ─────────────────────────────────────────────────────────────────

describe('fileApi', () => {
  describe('uploadFile', () => {
    const mockFile = () => new File(['data'], 'report.pdf', { type: 'application/pdf' });

    it('POSTs to /api/files and returns the response', async () => {
      const fileInfo: FileInfo = {
        fileName: 'report.pdf', storedName: 'stored-1.pdf',
        type: 'PDF', size: '4 B', uploadDate: '2024-01-01',
      };
      fetchMock.mockResolvedValueOnce(okResponse({ message: 'Uploaded', file: fileInfo }));

      const result = await fileApi.uploadFile(mockFile());

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/files',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.file).toEqual(fileInfo);
    });

    it('includes X-Session-ID header when chatApi.sessionId is set', async () => {
      chatApi.sessionId = 'sess-xyz';
      fetchMock.mockResolvedValueOnce(okResponse({ message: 'ok', file: {} }));

      await fileApi.uploadFile(mockFile());

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['X-Session-ID']).toBe('sess-xyz');
    });

    it('omits X-Session-ID header when sessionId is null', async () => {
      fetchMock.mockResolvedValueOnce(okResponse({ message: 'ok', file: {} }));

      await fileApi.uploadFile(mockFile());

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['X-Session-ID']).toBeUndefined();
    });

    it('throws the server error message on a non-ok response', async () => {
      fetchMock.mockResolvedValueOnce(errResponse({ error: 'File too large' }));

      await expect(fileApi.uploadFile(mockFile())).rejects.toThrow('File too large');
    });

    it('throws a generic message when the error body is empty', async () => {
      fetchMock.mockResolvedValueOnce(errResponse({}));

      await expect(fileApi.uploadFile(mockFile())).rejects.toThrow('Failed to upload file');
    });
  });

  describe('getAllFiles', () => {
    it('GETs /api/files and returns the file list', async () => {
      const files: FileInfo[] = [
        { fileName: 'a.pdf', storedName: 'sa.pdf', type: 'PDF', size: '1 KB', uploadDate: '2024-01-01' },
      ];
      fetchMock.mockResolvedValueOnce(okResponse({ files }));

      const result = await fileApi.getAllFiles();

      expect(fetchMock).toHaveBeenCalledWith('/api/files');
      expect(result.files).toEqual(files);
    });

    it('throws the server error message on a non-ok response', async () => {
      fetchMock.mockResolvedValueOnce(errResponse({ error: 'Unauthorized' }));

      await expect(fileApi.getAllFiles()).rejects.toThrow('Unauthorized');
    });

    it('throws a generic message when the error body is empty', async () => {
      fetchMock.mockResolvedValueOnce(errResponse({}));

      await expect(fileApi.getAllFiles()).rejects.toThrow('Failed to get files');
    });
  });

  describe('deleteFile', () => {
    it('sends DELETE to /api/files/:filename and returns the response', async () => {
      fetchMock.mockResolvedValueOnce(okResponse({ message: 'Deleted' }));

      const result = await fileApi.deleteFile('stored-1.pdf');

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/files/stored-1.pdf',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(result.message).toBe('Deleted');
    });

    it('throws the server error message on a non-ok response', async () => {
      fetchMock.mockResolvedValueOnce(errResponse({ error: 'Not found' }));

      await expect(fileApi.deleteFile('missing.pdf')).rejects.toThrow('Not found');
    });

    it('throws a generic message when the error body is empty', async () => {
      fetchMock.mockResolvedValueOnce(errResponse({}));

      await expect(fileApi.deleteFile('f.pdf')).rejects.toThrow('Failed to delete file');
    });
  });
});

// ─── chatApi ─────────────────────────────────────────────────────────────────

describe('chatApi', () => {
  describe('createWebSocket', () => {
    it('creates a WebSocket connecting to the /api/chat endpoint', () => {
      const cb = defaultCallbacks();
      chatApi.createWebSocket(
        cb.onUserMessage, cb.onAgentMessage, cb.onTypingStart, cb.onTypingStop,
        cb.onSessionReset, cb.onConnected, cb.onError,
      );

      expect(WsConstructor).toHaveBeenCalledWith(expect.stringContaining('/api/chat'));
    });

    it('returns the underlying WebSocket instance', () => {
      const cb = defaultCallbacks();
      const ws = chatApi.createWebSocket(
        cb.onUserMessage, cb.onAgentMessage, cb.onTypingStart, cb.onTypingStop,
        cb.onSessionReset, cb.onConnected, cb.onError,
      );

      expect(ws).toBe(lastWs);
    });

    it('populates chatApi.ws once the socket opens', () => {
      connectWs();

      expect(chatApi.ws).toBe(lastWs);
    });

    it('sets chatApi.ws to null when the socket closes', () => {
      connectWs();
      lastWs!.close();

      expect(chatApi.ws).toBeNull();
    });

    it('forwards socket errors to onError', () => {
      const cb = defaultCallbacks();
      chatApi.createWebSocket(
        cb.onUserMessage, cb.onAgentMessage, cb.onTypingStart, cb.onTypingStop,
        cb.onSessionReset, cb.onConnected, cb.onError,
      );
      const errorEvent = new Event('error');
      lastWs!.emitError(errorEvent);

      expect(cb.onError).toHaveBeenCalledWith(errorEvent);
    });

    // ── message routing ───────────────────────────────────────────────────────

    describe('message routing', () => {
      let cb: ReturnType<typeof defaultCallbacks>;

      beforeEach(() => {
        cb = defaultCallbacks();
        chatApi.createWebSocket(
          cb.onUserMessage, cb.onAgentMessage, cb.onTypingStart, cb.onTypingStop,
          cb.onSessionReset, cb.onConnected, cb.onError,
          cb.onSystemMessage, cb.onNewSession,
        );
      });

      it('"connected" stores sessionId and calls onConnected', () => {
        lastWs!.emitMessage({ event: 'connected', data: { session: { sessionId: 'sess-1' } } });

        expect(chatApi.sessionId).toBe('sess-1');
        expect(cb.onConnected).toHaveBeenCalledWith({ sessionId: 'sess-1' });
      });

      it('"connected" with no session leaves sessionId null', () => {
        lastWs!.emitMessage({ event: 'connected', data: {} });

        expect(chatApi.sessionId).toBeNull();
        expect(cb.onConnected).toHaveBeenCalledWith(undefined);
      });

      it('"userMessage" calls onUserMessage', () => {
        const msg: Message = { id: '1', sessionId: 's', text: 'Hi', sender: 'user', timestamp: 't' };
        lastWs!.emitMessage({ event: 'userMessage', data: msg });

        expect(cb.onUserMessage).toHaveBeenCalledWith(msg);
      });

      it('"agentMessage" calls onAgentMessage', () => {
        const msg: Message = { id: '2', sessionId: 's', text: 'Hello!', sender: 'agent', timestamp: 't' };
        lastWs!.emitMessage({ event: 'agentMessage', data: msg });

        expect(cb.onAgentMessage).toHaveBeenCalledWith(msg);
      });

      it('"systemMessage" calls onSystemMessage', () => {
        const msg: Message = { id: '3', sessionId: 's', text: 'sys', sender: 'system', timestamp: 't' };
        lastWs!.emitMessage({ event: 'systemMessage', data: msg });

        expect(cb.onSystemMessage).toHaveBeenCalledWith(msg);
      });

      it('"systemMessage" without the optional callback does not throw', () => {
        const minCb = defaultCallbacks();
        chatApi.createWebSocket(
          minCb.onUserMessage, minCb.onAgentMessage, minCb.onTypingStart, minCb.onTypingStop,
          minCb.onSessionReset, minCb.onConnected, minCb.onError,
          // onSystemMessage omitted
        );
        expect(() => lastWs!.emitMessage({ event: 'systemMessage', data: {} })).not.toThrow();
      });

      it('"typingStart" calls onTypingStart', () => {
        lastWs!.emitMessage({ event: 'typingStart', data: {} });

        expect(cb.onTypingStart).toHaveBeenCalled();
      });

      it('"typingStop" calls onTypingStop', () => {
        lastWs!.emitMessage({ event: 'typingStop', data: {} });

        expect(cb.onTypingStop).toHaveBeenCalled();
      });

      it('"sessionReset" calls onSessionReset', () => {
        lastWs!.emitMessage({ event: 'sessionReset', data: {} });

        expect(cb.onSessionReset).toHaveBeenCalled();
      });

      it('"newSession" updates sessionId and calls onNewSession', () => {
        lastWs!.emitMessage({ event: 'newSession', data: { session: { sessionId: 'new-sess' } } });

        expect(chatApi.sessionId).toBe('new-sess');
        expect(cb.onNewSession).toHaveBeenCalledWith('new-sess');
      });

      it('"newSession" without the optional callback does not throw', () => {
        const minCb = defaultCallbacks();
        chatApi.createWebSocket(
          minCb.onUserMessage, minCb.onAgentMessage, minCb.onTypingStart, minCb.onTypingStop,
          minCb.onSessionReset, minCb.onConnected, minCb.onError,
          minCb.onSystemMessage,
          // onNewSession omitted
        );
        expect(() =>
          lastWs!.emitMessage({ event: 'newSession', data: { session: { sessionId: 'x' } } })
        ).not.toThrow();
      });

      it('unknown event type does not throw', () => {
        expect(() => lastWs!.emitMessage({ event: 'someFutureEvent', data: {} })).not.toThrow();
      });
    });
  });

  // ── sendMessage ──────────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('sends { action: "sendMessage", text } when connected', () => {
      const ws = connectWs();
      chatApi.sendMessage('What is my balance?');

      expect(ws.sent).toContainEqual({ action: 'sendMessage', text: 'What is my balance?' });
    });

    it('throws when the socket is not in the OPEN state', () => {
      const ws = connectWs();
      ws.readyState = MockWebSocket.CLOSED;

      expect(() => chatApi.sendMessage('hi')).toThrow('WebSocket is not connected');
    });
  });

  // ── getAllMessages ────────────────────────────────────────────────────────────

  describe('getAllMessages', () => {
    it('sends { action: "getMessages" } when connected', () => {
      const ws = connectWs();
      chatApi.getAllMessages();

      expect(ws.sent).toContainEqual({ action: 'getMessages' });
    });

    it('throws when not connected', () => {
      expect(() => chatApi.getAllMessages()).toThrow('WebSocket is not connected');
    });
  });

  // ── getTypingStatus ───────────────────────────────────────────────────────────

  describe('getTypingStatus', () => {
    it('sends { action: "getTypingStatus" } when connected', () => {
      const ws = connectWs();
      chatApi.getTypingStatus();

      expect(ws.sent).toContainEqual({ action: 'getTypingStatus' });
    });

    it('throws when not connected', () => {
      expect(() => chatApi.getTypingStatus()).toThrow('WebSocket is not connected');
    });
  });

  // ── startNewSession ───────────────────────────────────────────────────────────

  describe('startNewSession', () => {
    it('sends { action: "startNewSession" } when connected', () => {
      const ws = connectWs();
      chatApi.startNewSession();

      expect(ws.sent).toContainEqual({ action: 'startNewSession' });
    });

    it('throws when not connected', () => {
      expect(() => chatApi.startNewSession()).toThrow('WebSocket is not connected');
    });
  });
});

// ─── WebSocket URL detection ──────────────────────────────────────────────────

describe('WebSocket URL detection', () => {
  it('uses ws://localhost:5001/api on localhost', () => {
    const url = getWebSocketUrl({ hostname: 'localhost', protocol: 'http:', host: 'localhost:3000' });
    expect(url).toBe('ws://localhost:5001/api');
  });

  it('uses wss:// on a production HTTPS host', () => {
    const url = getWebSocketUrl({ hostname: 'my-app.cfapps.io', protocol: 'https:', host: 'my-app.cfapps.io' });
    expect(url).toBe('wss://my-app.cfapps.io/api');
  });

  it('uses ws:// on a production HTTP host', () => {
    const url = getWebSocketUrl({ hostname: 'my-app.cfapps.io', protocol: 'http:', host: 'my-app.cfapps.io' });
    expect(url).toBe('ws://my-app.cfapps.io/api');
  });

});
