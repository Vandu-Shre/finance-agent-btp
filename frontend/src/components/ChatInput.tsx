import { useState } from 'react';
import { Input, Button } from '@ui5/webcomponents-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled: boolean;
  isWsConnected: boolean;
  errorMessage?: string;
}

export function ChatInput({ onSendMessage, disabled, isWsConnected, errorMessage }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message);
    setMessage('');
  };

  const placeholder = errorMessage || 'Type your message...';

  return (
    <div style={{
      display: 'flex',
      gap: '0.5rem',
      padding: '1rem 2rem',
      alignItems: 'center'
    }}>
      <Input
        value={message}
        onInput={(e) => setMessage(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleSend();
          }
        }}
        placeholder={placeholder}
        style={{ flex: 1 }}
        disabled={disabled}
        valueState={errorMessage ? 'Negative' : 'None'}
      />
      <Button
        icon="paper-plane"
        design="Emphasized"
        onClick={handleSend}
        disabled={disabled || !message.trim() || !isWsConnected}
      >
        Send
      </Button>
    </div>
  );
}
