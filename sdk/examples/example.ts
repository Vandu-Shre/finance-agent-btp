// Local import (for development before publishing)
import FinanceAgentSDK, { type FileInfo, type Session, type Message } from '../src/index.js';

// After publishing to npm/GitHub Packages, use:
// import FinanceAgentSDK, { type FileInfo, type Session, type Message } from '@vandanashree/finance-agent';

/**
 * Example usage of the Finance Agent SDK
 */
async function example() {
  // Initialize the SDK
  const client = new FinanceAgentSDK({
    baseUrl: 'https://your-app.cfapps.eu10.hana.ondemand.com',
  });

  try {
    // === File Operations ===

    // List all files
    console.log('Fetching all files...');
    const files = await client.files.getFiles();
    console.log(`Found ${files.length} files:`);
    files.forEach((file: FileInfo) => {
      console.log(`  - ${file.fileName} (${file.size})`);
    });

    // Upload a file (Node.js example)
    // Uncomment if you want to test file upload
    /*
    import fs from 'fs';
    const buffer = fs.readFileSync('./example.pdf');
    const uploadResult = await client.files.uploadFile({
      buffer,
      filename: 'example.pdf'
    });
    console.log('File uploaded:', uploadResult.file.fileName);
    */

    // Delete a file
    // const deleteMessage = await client.files.deleteFile('stored-filename.pdf');
    // console.log(deleteMessage);

    // === Chat Operations ===

    // Connect to chat
    console.log('\nConnecting to chat...');
    await client.chat.connect({
      onConnected: (session: Session) => {
        console.log(`Connected to session: ${session.sessionId}`);
        console.log(`Session created at: ${session.createdAt}`);
      },
      onUserMessage: (message: Message) => {
        console.log(`[${message.timestamp}] You: ${message.text}`);
      },
      onAgentMessage: (message: Message) => {
        console.log(`[${message.timestamp}] Agent: ${message.text}`);
      },
      onTypingStart: () => {
        console.log('Agent is typing...');
      },
      onTypingStop: () => {
        console.log('Agent stopped typing.');
      },
      onSessionReset: () => {
        console.log('Session has been reset');
      },
      onError: (error: string) => {
        console.error('Chat error:', error);
      },
    });

    // Send a message
    console.log('\nSending message...');
    client.chat.sendMessage('Hello! Can you help me with my finances?');

    // Wait for responses
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Get all messages
    console.log('\nRequesting all messages...');
    client.chat.getMessages();

    // Wait a bit more
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Start a new session
    console.log('\nStarting new session...');
    client.chat.startNewSession();

    // Keep connection alive for a while
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Disconnect
    console.log('\nDisconnecting...');
    client.chat.disconnect();
    console.log('Disconnected successfully');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
example().catch(console.error);
