import { FileClient } from './file-client.js';
import { ChatClient } from './chat-client.js';
import type { FinanceAgentConfig } from './types.js';

/**
 * Main Finance Agent SDK Client
 */
export class FinanceAgentSDK {
  public files: FileClient;
  public chat: ChatClient;

  constructor(config: FinanceAgentConfig) {
    this.files = new FileClient(config);
    this.chat = new ChatClient(config);
  }
}

// Export types
export * from './types.js';
export { FileClient } from './file-client.js';
export { ChatClient } from './chat-client.js';

// Default export
export default FinanceAgentSDK;
