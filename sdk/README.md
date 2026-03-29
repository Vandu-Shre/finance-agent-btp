# Finance Agent SDK

TypeScript/JavaScript SDK for interacting with the Finance Agent API.

## Installation

```bash
npm install @vandanashree/sdk
```

## Usage

### Initialize the SDK

```typescript
import FinanceAgentSDK from '@vandanashree/sdk';

const client = new FinanceAgentSDK({
  baseUrl: 'https://your-app.cfapps.eu10.hana.ondemand.com',
});
```

### File Operations

#### Upload a File

```typescript
// Browser
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const result = await client.files.uploadFile(file);
console.log('Uploaded:', result.file);

// Node.js
import fs from 'fs';
const buffer = fs.readFileSync('./document.pdf');
const result = await client.files.uploadFile({
  buffer,
  filename: 'document.pdf'
});
```

#### List All Files

```typescript
const files = await client.files.getFiles();
console.log('Files:', files);
```

#### Delete a File

```typescript
const message = await client.files.deleteFile('stored-filename.pdf');
console.log(message); // "File deleted successfully"
```

### Chat Operations

#### Connect to Chat

```typescript
await client.chat.connect({
  onConnected: (session) => {
    console.log('Connected to session:', session.sessionId);
  },
  onAgentMessage: (message) => {
    console.log('Agent says:', message.text);
  },
  onUserMessage: (message) => {
    console.log('User says:', message.text);
  },
  onTypingStart: () => {
    console.log('Agent is typing...');
  },
  onTypingStop: () => {
    console.log('Agent stopped typing');
  },
  onError: (error) => {
    console.error('Chat error:', error);
  },
});
```

#### Send a Message

```typescript
client.chat.sendMessage('Hello, how can you help me?');
```

#### Get All Messages

```typescript
client.chat.getMessages();
```

#### Start New Session

```typescript
client.chat.startNewSession();
```

#### Disconnect

```typescript
client.chat.disconnect();
```

### Complete Example

```typescript
import FinanceAgentSDK from '@vandanashree/sdk';

async function main() {
  // Initialize SDK
  const client = new FinanceAgentSDK({
    baseUrl: 'https://your-app.cfapps.eu10.hana.ondemand.com',
  });

  // Connect to chat
  await client.chat.connect({
    onAgentMessage: (message) => {
      console.log('Agent:', message.text);
    },
  });

  // Send a message
  client.chat.sendMessage('What files do I have?');

  // List files
  const files = await client.files.getFiles();
  console.log('Available files:', files.length);

  // Disconnect when done
  setTimeout(() => {
    client.chat.disconnect();
  }, 30000);
}

main().catch(console.error);
```

## API Reference

### `FinanceAgentSDK`

Main SDK class that provides access to file and chat clients.

#### Constructor

```typescript
new FinanceAgentSDK(config: FinanceAgentConfig)
```

**Config options:**
- `baseUrl` (required): Base URL of the Finance Agent API
- `headers` (optional): Custom headers

### `FileClient`

Handles file operations.

#### Methods

- `uploadFile(file)`: Upload a file
- `getFiles()`: Get list of all files
- `deleteFile(filename)`: Delete a file by stored name

### `ChatClient`

Handles WebSocket-based chat communication.

#### Methods

- `connect(handlers)`: Connect to chat WebSocket
- `sendMessage(text)`: Send a chat message
- `getMessages()`: Request all messages
- `getTypingStatus()`: Get current typing status
- `startNewSession()`: Start a new chat session
- `disconnect()`: Disconnect from WebSocket
- `isConnected()`: Check connection status

## Types

See [types.ts](./src/types.ts) for complete type definitions.

## Roadmap

### Authentication (Coming Soon)

Future versions of this SDK will include built-in support for SAP Identity and Access Management (IAS) and XSUAA authentication flows:

- **Client Credentials Flow** — for server-to-server integrations where the application authenticates directly using a client ID and secret, without user involvement.
- **Authorization Code Flow** — for user-facing applications where end users authenticate via IAS/XSUAA and the SDK exchanges the authorization code for an access token automatically.

These additions will make it straightforward to integrate the SDK securely into SAP BTP environments without manually managing tokens.

## License

MIT
