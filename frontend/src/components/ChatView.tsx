import { useState, useEffect } from 'react';
import { MessageStrip, Button } from '@ui5/webcomponents-react';
import { Message, chatApi } from '../api';
import { Header } from './Header';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

interface ChatViewProps {
  isDarkMode: boolean;
}

export function ChatView({ isDarkMode }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewSessionConfirm, setShowNewSessionConfirm] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoadingMessages(true);
    setIsWsConnected(false);
    setError(null);

    const ws = chatApi.createWebSocket(
      // onUserMessage
      (message) => {
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      },
      // onAgentMessage
      (message) => {
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      },
      // onTypingStart
      () => {
        setIsAgentTyping(true);
      },
      // onTypingStop
      () => {
        setIsAgentTyping(false);
      },
      // onSessionReset
      () => {
        setMessages([]);
        setIsAgentTyping(false);
        setError(null);
      },
      // onConnected
      (session) => {
        console.log('Connected to chat, received session:', session);
        setMessages(session.messages || []);
        setIsAgentTyping(session.isAgentTyping || false);
        setIsLoadingMessages(false);
        setIsWsConnected(true);
        setError(null);
        setSessionId(session.sessionId ?? null);
      },
      // onError
      (error) => {
        console.error('WebSocket connection error:', error);
        setIsLoadingMessages(false);
        setIsWsConnected(false);
        setError('Failed to connect to chat server. Please refresh the page.');
      },
      // onSystemMessage
      (message) => {
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      },
      // onNewSession
      (newSessionId) => {
        setSessionId(newSessionId);
      }
    );

    return () => {
      setIsWsConnected(false);
      ws.close();
    };
  }, []);

  const handleSendMessage = (message: string) => {
    if (!isWsConnected) {
      setError('Not connected to chat server. Cannot send message.');
      return;
    }

    try {
      chatApi.sendMessage(message);
      setError(null);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please check your connection.');
    }
  };

  const handleNewSessionRequest = () => {
    setShowNewSessionConfirm(true);
  };

  const handleNewSessionConfirm = () => {
    setShowNewSessionConfirm(false);
    try {
      chatApi.startNewSession();
      setError(null);
    } catch (error) {
      console.error('Error starting new session:', error);
      setError('Failed to start new session. Please try again.');
    }
  };

  const handleNewSessionCancel = () => {
    setShowNewSessionConfirm(false);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <Header
        title="Chat"
        subtitle={sessionId ? `Session: ${sessionId}` : undefined}
        buttonText="New Session"
        buttonIcon="add"
        onButtonClick={handleNewSessionRequest}
        isDarkMode={isDarkMode}
      />

      {error && (
        <MessageStrip
          design="Negative"
          hideCloseButton={false}
          onClose={() => setError(null)}
          style={{ margin: '0.5rem 2rem', width: 'calc(100% - 4rem)' }}
        >
          {error}
        </MessageStrip>
      )}

      {showNewSessionConfirm && (
        <MessageStrip
          design="Critical"
          hideCloseButton={true}
          style={{
            margin: '0.5rem 2rem',
            width: 'calc(100% - 4rem)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>Are you sure you want to start a new session? This will clear the chat history.</span>
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
            <Button design="Emphasized" onClick={handleNewSessionConfirm}>
              Confirm
            </Button>
            <Button design="Transparent" onClick={handleNewSessionCancel}>
              Cancel
            </Button>
          </div>
        </MessageStrip>
      )}

      <MessageList
        messages={messages}
        isLoading={isLoadingMessages}
        isAgentTyping={isAgentTyping}
        isDarkMode={isDarkMode}
      />
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isAgentTyping || !isWsConnected}
        isWsConnected={isWsConnected}
        errorMessage={!isWsConnected && !isLoadingMessages ? 'Not connected to server' : undefined}
      />
    </div>
  );
}
