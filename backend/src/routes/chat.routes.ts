import express from 'express';
import expressWs from 'express-ws';
import WebSocket from 'ws';
import chatService from '../services/chat.service.js';

const router = express.Router();
const wsInstance = expressWs(router as any);
const wsRouter = wsInstance.app;

// WebSocket client management
type WSClient = {
  id: string;
  ws: WebSocket;
};

const wsClients: WSClient[] = [];

// Broadcast function for chat service
const broadcastToClients = (event: string, data: any): void => {
  console.log(`Broadcasting WebSocket event: ${event}, clients: ${wsClients.length}`);
  const message = JSON.stringify({ event, data });

  wsClients.forEach(client => {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    } catch (error) {
      console.error('Error sending WebSocket message to client:', error);
      removeWSClient(client.id);
    }
  });
};

// Set broadcast callback for chat service
chatService.setBroadcastCallback(broadcastToClients);

const addWSClient = (ws: WebSocket): string => {
  const clientId = `client-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  wsClients.push({ id: clientId, ws });
  return clientId;
};

const removeWSClient = (clientId: string): void => {
  const index = wsClients.findIndex(client => client.id === clientId);
  if (index !== -1) wsClients.splice(index, 1);
  console.log(`WebSocket client removed, remaining clients: ${wsClients.length}`);
};

const send = (ws: any, event: string, data: any): void =>
  ws.send(JSON.stringify({ event, data }));

function handleAction(ws: any, payload: any): void {
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
}

// WebSocket endpoint - handles all chat communication
wsRouter.ws('/', (ws: any) => {
  const clientId = addWSClient(ws);
  console.log(`WebSocket client connected: ${clientId}, total: ${wsClients.length}`);
  send(ws, 'connected', { status: 'connected', session: chatService.getCurrentSession() });

  ws.on('message', (data: string) => {
    try {
      const payload = JSON.parse(data);
      console.log('Received WebSocket message:', payload);
      handleAction(ws, payload);
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      send(ws, 'error', { error: 'Failed to process message' });
    }
  });

  ws.on('close', () => { console.log(`WebSocket client disconnected: ${clientId}`); removeWSClient(clientId); });
  ws.on('error', (error: any) => { console.error(`WebSocket error for client ${clientId}:`, error); removeWSClient(clientId); });
});

export default wsRouter;
