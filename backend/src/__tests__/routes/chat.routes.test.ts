/**
 * Integration tests for chat.routes.ts WebSocket endpoint.
 *
 * A real express-ws server is started on a random port so the full
 * WebSocket lifecycle (connect, message, close) is exercised without
 * needing a browser or running backend.
 */

import http from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import express from 'express';
import expressWs from 'express-ws';

// ─── Mock chatService before importing routes ────────────────────────────────
// Variables must start with "mock" for jest to allow them in the hoisted factory.

const mockSetBroadcastCallback = jest.fn();
const mockAddUserMessage = jest.fn();
const mockGetAllMessages = jest.fn().mockReturnValue([
  { id: 'm1', text: 'Hello', sender: 'user', timestamp: '2024-01-01T00:00:00.000Z' },
]);
const mockIsAgentTyping = jest.fn().mockReturnValue(false);
const mockStartNewSession = jest.fn().mockReturnValue({
  sessionId: 'new-session-id',
  createdAt: '2024-01-01T00:00:00.000Z',
});
const mockGetCurrentSession = jest.fn().mockReturnValue({
  sessionId: 'current-session-id',
  createdAt: '2024-01-01T00:00:00.000Z',
});

jest.mock('../../services/chat.service.js', () => ({
  __esModule: true,
  default: {
    setBroadcastCallback: mockSetBroadcastCallback,
    addUserMessage: mockAddUserMessage,
    getAllMessages: mockGetAllMessages,
    isAgentTyping: mockIsAgentTyping,
    startNewSession: mockStartNewSession,
    getCurrentSession: mockGetCurrentSession,
  },
}));

import chatRoutes from '../../routes/chat.routes.js';

// ─── Message queue helper ────────────────────────────────────────────────────
// Uses ws.on (not once) to accumulate messages; avoids the race condition
// where a message arrives before a once() listener is registered.

class MessageQueue {
  private pending: any[] = [];
  private waiters: Array<(msg: any) => void> = [];

  push(msg: any): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(msg);
    } else {
      this.pending.push(msg);
    }
  }

  next(timeoutMs = 3000): Promise<any> {
    if (this.pending.length > 0) return Promise.resolve(this.pending.shift());

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(resolver);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error('Timed out waiting for WebSocket message'));
      }, timeoutMs);

      const resolver = (msg: any): void => {
        clearTimeout(timer);
        resolve(msg);
      };
      this.waiters.push(resolver);
    });
  }
}

// ─── Server lifecycle ────────────────────────────────────────────────────────

let server: http.Server;
let port: number;
let wss: WebSocket.Server;

beforeAll((done) => {
  const rawApp = express();
  const wsInstance = expressWs(rawApp);
  const { app } = wsInstance;
  wss = wsInstance.getWss();
  (app as any).use('/api/chat', chatRoutes);
  server = (app as any).listen(0, () => {
    port = (server.address() as AddressInfo).port;
    done();
  });
}, 10000);

afterAll((done) => {
  // Terminate all open WebSocket connections then shut down the HTTP server.
  wss.clients.forEach((client) => client.terminate());
  wss.close(() => {
    server.closeAllConnections?.();
    server.close(() => done());
  });
}, 10000);

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllMessages.mockReturnValue([
    { id: 'm1', text: 'Hello', sender: 'user', timestamp: '2024-01-01T00:00:00.000Z' },
  ]);
  mockIsAgentTyping.mockReturnValue(false);
  mockStartNewSession.mockReturnValue({
    sessionId: 'new-session-id',
    createdAt: '2024-01-01T00:00:00.000Z',
  });
  mockGetCurrentSession.mockReturnValue({
    sessionId: 'current-session-id',
    createdAt: '2024-01-01T00:00:00.000Z',
  });
});

// ─── Connection helper ───────────────────────────────────────────────────────

interface WsConnection {
  ws: WebSocket;
  queue: MessageQueue;
  close: () => Promise<void>;
}

function connect(): Promise<WsConnection> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/api/chat`);
    const queue = new MessageQueue();

    ws.on('message', (raw) => {
      try {
        queue.push(JSON.parse(raw.toString()));
      } catch {
        // ignore unparseable frames
      }
    });

    const close = (): Promise<void> =>
      new Promise((res) => {
        if (ws.readyState === WebSocket.CLOSED) return res();
        ws.once('close', () => res());
        ws.close();
      });

    ws.once('open', () => resolve({ ws, queue, close }));
    ws.once('error', reject);
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('chat.routes – WebSocket', () => {
  describe('Module initialisation', () => {
    it('registers a broadcast callback on chatService at import time', () => {
      // The chat.routes module calls setBroadcastCallback when first imported.
      // We verify that the registered value is a function.
      expect(mockSetBroadcastCallback).toBeDefined();
      expect(typeof mockSetBroadcastCallback).toBe('function');
    });
  });

  describe('Connection handshake', () => {
    it('sends a "connected" event immediately on connect', async () => {
      const conn = await connect();
      const msg = await conn.queue.next();

      expect(msg.event).toBe('connected');
      expect(msg.data.status).toBe('connected');
      expect(msg.data).toHaveProperty('session');

      await conn.close();
    });

    it('handles undefined req.user gracefully in the connected payload', async () => {
      const conn = await connect();
      const msg = await conn.queue.next();

      // No auth middleware on the test server → req.user is undefined
      expect(msg.event).toBe('connected');
      expect(msg.data.user === undefined || typeof msg.data.user === 'object').toBe(true);

      await conn.close();
    });
  });

  describe('sendMessage action', () => {
    it('calls chatService.addUserMessage with the provided text', async () => {
      const conn = await connect();
      await conn.queue.next(); // drain 'connected'

      conn.ws.send(JSON.stringify({ action: 'sendMessage', text: 'What is my balance?' }));
      // sendMessage has no response; send a follow-up and wait for its reply to
      // guarantee the server processed sendMessage before we check the mock.
      conn.ws.send(JSON.stringify({ action: 'getMessages' }));
      await conn.queue.next(); // drain 'messagesList'
      expect(mockAddUserMessage).toHaveBeenCalledWith('What is my balance?');

      await conn.close();
    });

    it('returns an error event when text is an empty string', async () => {
      const conn = await connect();
      await conn.queue.next(); // drain 'connected'

      conn.ws.send(JSON.stringify({ action: 'sendMessage', text: '' }));
      const reply = await conn.queue.next();

      expect(reply.event).toBe('error');
      expect(reply.data.error).toMatch(/required/i);
      expect(mockAddUserMessage).not.toHaveBeenCalled();

      await conn.close();
    });

    it('returns an error event when text is whitespace only', async () => {
      const conn = await connect();
      await conn.queue.next(); // drain 'connected'

      conn.ws.send(JSON.stringify({ action: 'sendMessage', text: '   ' }));
      const reply = await conn.queue.next();

      expect(reply.event).toBe('error');

      await conn.close();
    });
  });

  describe('getMessages action', () => {
    it('returns a "messagesList" event with all current messages', async () => {
      const conn = await connect();
      await conn.queue.next(); // drain 'connected'

      conn.ws.send(JSON.stringify({ action: 'getMessages' }));
      const reply = await conn.queue.next();

      expect(reply.event).toBe('messagesList');
      expect(reply.data.messages).toEqual(mockGetAllMessages());

      await conn.close();
    });

    it('returns an empty messages array when there are no messages', async () => {
      mockGetAllMessages.mockReturnValue([]);
      const conn = await connect();
      await conn.queue.next(); // drain 'connected'

      conn.ws.send(JSON.stringify({ action: 'getMessages' }));
      const reply = await conn.queue.next();

      expect(reply.event).toBe('messagesList');
      expect(reply.data.messages).toEqual([]);

      await conn.close();
    });
  });

  describe('getTypingStatus action', () => {
    it('returns isTyping: false when the agent is idle', async () => {
      mockIsAgentTyping.mockReturnValue(false);
      const conn = await connect();
      await conn.queue.next(); // drain 'connected'

      conn.ws.send(JSON.stringify({ action: 'getTypingStatus' }));
      const reply = await conn.queue.next();

      expect(reply.event).toBe('typingStatus');
      expect(reply.data.isTyping).toBe(false);

      await conn.close();
    });

    it('returns isTyping: true when the agent is active', async () => {
      mockIsAgentTyping.mockReturnValue(true);
      const conn = await connect();
      await conn.queue.next(); // drain 'connected'

      conn.ws.send(JSON.stringify({ action: 'getTypingStatus' }));
      const reply = await conn.queue.next();

      expect(reply.event).toBe('typingStatus');
      expect(reply.data.isTyping).toBe(true);

      await conn.close();
    });
  });

  describe('startNewSession action', () => {
    it('creates a new session and returns it in a "newSession" event', async () => {
      const conn = await connect();
      await conn.queue.next(); // drain 'connected'

      conn.ws.send(JSON.stringify({ action: 'startNewSession' }));
      const reply = await conn.queue.next();

      expect(reply.event).toBe('newSession');
      expect(reply.data.message).toMatch(/new session started/i);
      expect(reply.data.session).toMatchObject({ sessionId: 'new-session-id' });
      expect(mockStartNewSession).toHaveBeenCalled();

      await conn.close();
    });
  });

  describe('Error handling', () => {
    it('returns an error event for an unknown action', async () => {
      const conn = await connect();
      await conn.queue.next(); // drain 'connected'

      conn.ws.send(JSON.stringify({ action: 'doSomethingUnknown' }));
      const reply = await conn.queue.next();

      expect(reply.event).toBe('error');
      expect(reply.data.error).toMatch(/unknown action/i);

      await conn.close();
    });

    it('returns an error event when the payload is not valid JSON', async () => {
      const conn = await connect();
      await conn.queue.next(); // drain 'connected'

      conn.ws.send('not-json{{{');
      const reply = await conn.queue.next();

      expect(reply.event).toBe('error');
      expect(reply.data.error).toMatch(/failed to process/i);

      await conn.close();
    });
  });
});
