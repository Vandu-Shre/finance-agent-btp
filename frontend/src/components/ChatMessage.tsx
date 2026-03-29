import { Card, Label, Avatar, Icon } from '@ui5/webcomponents-react';
import { Message } from '../api';

interface ChatMessageProps {
  message: Message;
  isDarkMode: boolean;
}

export function ChatMessage({ message, isDarkMode }: ChatMessageProps) {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  // System messages have a special centered layout
  if (isSystem) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          margin: '0.5rem 0'
        }}
      >
        <Card style={{
          backgroundColor: isDarkMode ? '#1f2830' : '#e8f5e9',
          border: isDarkMode ? '1px solid #2d3640' : '1px solid #c8e6c9',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          maxWidth: '80%'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            justifyContent: 'center'
          }}>
            <Icon
              name={
                message.metadata?.type === 'file-added' ? 'document' :
                message.metadata?.type === 'file-deleted' ? 'delete' :
                message.metadata?.type === 'files-loaded' ? 'folder' :
                'information'
              }
              style={{
                fontSize: '0.875rem',
                color: isDarkMode ? '#81c784' : '#388e3c'
              }}
            />
            <Label
              style={{
                fontSize: '0.875rem',
                color: isDarkMode ? '#81c784' : '#388e3c',
                fontStyle: 'italic'
              }}
            >
              {message.text}
            </Label>
          </div>
        </Card>
      </div>
    );
  }

  // Regular user/agent messages
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start'
      }}
    >
      <Card style={{
        maxWidth: '70%',
        backgroundColor: isUser
          ? (isDarkMode ? '#2c3540' : '#e3f2fd')
          : (isDarkMode ? '#2c3540' : '#f5f5f5'),
        overflow: 'hidden',
        borderRadius: '1rem'
      }}>
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
            <Avatar
              size="XS"
              style={{ marginRight: '0.5rem' }}
              icon={message.sender === 'agent' ? 'customer-financial-fact-sheet' : undefined}
              colorScheme={message.sender === 'agent' ? 'Accent4' : 'Accent6'}
            >
              {isUser ? 'JM' : ''}
            </Avatar>
            <Label style={{ fontWeight: 'bold' }}>
              {isUser ? 'You' : 'Finance Agent'}
            </Label>
          </div>
          <Label>{message.text}</Label>
        </div>
      </Card>
    </div>
  );
}
