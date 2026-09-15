import { ChatService } from './chat.service.js';

const sessions = new Map<string, ChatService>();

/**
 * Return (or create) the ChatService instance for the given userId.
 * Each user gets exactly one long-lived session.
 */
export function getSessionForUser(userId: string): ChatService {
  if (!sessions.has(userId)) {
    sessions.set(userId, new ChatService(userId));
  }
  return sessions.get(userId)!;
}
