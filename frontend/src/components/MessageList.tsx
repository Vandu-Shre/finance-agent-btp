import { useRef, useEffect } from 'react';
import { Label } from '@ui5/webcomponents-react';
import { Message } from '../api';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  isAgentTyping: boolean;
  isDarkMode: boolean;
}

export function MessageList({ messages, isLoading, isAgentTyping, isDarkMode }: MessageListProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAgentTyping]);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '1rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      backgroundColor: isDarkMode ? '#12171c' : '#f5f5f5'
    }}>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Label>Loading messages...</Label>
        </div>
      ) : messages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Label>No messages yet. Start a conversation!</Label>
        </div>
      ) : (
        messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} isDarkMode={isDarkMode} />
        ))
      )}

      {isAgentTyping && <TypingIndicator isDarkMode={isDarkMode} />}

      <div ref={chatEndRef} />
    </div>
  );
}
