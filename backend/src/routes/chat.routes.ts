import express, { Request } from 'express';
import expressWs from 'express-ws';
import WebSocket from 'ws';
import { getSessionForUser } from '../services/chat-session-manager.js';

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

  console.log(`WebSocket client connected: ${clientId}, user: ${userId}`);

  // Route events from this user's ChatService to this WebSocket connection
  chatService.setBroadcastCallback((event: string, data: any) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event, data }));
      }
    } catch (error) {
      console.error(`Error sending WebSocket event '${event}' to client ${clientId}:`, error);
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
      console.log('Received WebSocket message:', payload);
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
      console.error('Error processing WebSocket message:', error);
      send(ws, 'error', { error: 'Failed to process message' });
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket client disconnected: ${clientId}`);
    // Clear the broadcast callback so stale connections don't receive events
    chatService.setBroadcastCallback(() => {});
  });
  ws.on('error', (error: any) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
    chatService.setBroadcastCallback(() => {});
  });
});

export default wsRouter;
