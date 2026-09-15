import express, { Request } from 'express';
import expressWs from 'express-ws';
import WebSocket from 'ws';
import { getSessionForUser } from '../services/chat-session-manager.js';
import { logger } from '../lib/logger.js';

const router = express.Router();
const wsInstance = expressWs(router as any);
const wsRouter = wsInstance.app;

const send = (ws: any, event: string, data: any): void =>
  ws.send(JSON.stringify({ event, data }));

// WebSocket endpoint - handles all chat communication
wsRouter.ws('/', (ws: any, req: Request) => {
  const user = req.user;
  const userId = user?.sub ?? 'anonymous';
  const clientId = `client-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const chatService = getSessionForUser(userId);

  logger.info('WebSocket client connected', { clientId, userId });
  chatService.setBroadcastCallback((event: string, data: any) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event, data }));
      }
    } catch (error) {
      logger.error('Error sending WebSocket event', { event, clientId, userId, error: (error as Error).message });
    }
  });

  send(ws, 'connected', {
    status: 'connected',
    session: chatService.getCurrentSession(),
    user: user ? { sub: user.sub, email: user.email, name: user.given_name } : undefined,
  });

  ws.on('message', (data: string) => {
    try {
      const payload = JSON.parse(data);
      logger.debug('WebSocket message received', { clientId, action: payload.action, userId });
      switch (payload.action) {
        case 'sendMessage':
          if (!payload.text?.trim()) {
            send(ws, 'error', { error: 'Message text is required' });
            return;
          }
          chatService.addUserMessage(payload.text);
          break;
        case 'getMessages':
          send(ws, 'messagesList', { messages: chatService.getAllMessages() });
          break;
        case 'getTypingStatus':
          send(ws, 'typingStatus', { isTyping: chatService.isAgentTyping() });
          break;
        case 'startNewSession': {
          const session = chatService.startNewSession();
          send(ws, 'newSession', {
            message: 'New session started successfully',
            session: { sessionId: session.sessionId, createdAt: session.createdAt },
          });
          break;
        }
        default:
          send(ws, 'error', { error: 'Unknown action' });
      }
    } catch (error) {
      logger.error('Error processing WebSocket message', { clientId, userId, error: (error as Error).message });
      send(ws, 'error', { error: 'Failed to process message' });
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected', { clientId, userId });
    // Clear the broadcast callback so stale connections don't receive events
    chatService.setBroadcastCallback(() => {});
  });
  ws.on('error', (error: any) => {
    logger.error('WebSocket error', { clientId, userId, error: (error as Error).message });
    chatService.setBroadcastCallback(() => {});
  });
});

export default wsRouter;
