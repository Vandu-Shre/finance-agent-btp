import { Card, Label, Avatar } from '@ui5/webcomponents-react';

interface TypingIndicatorProps {
  isDarkMode: boolean;
}

export function TypingIndicator({ isDarkMode }: TypingIndicatorProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <Card style={{
        maxWidth: '70%',
        backgroundColor: isDarkMode ? '#2c3540' : '#f5f5f5',
        overflow: 'hidden',
        borderRadius: '1rem'
      }}>
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
            <Avatar size="XS" style={{ marginRight: '0.5rem' }} icon="customer-financial-fact-sheet" colorScheme="Accent4" />
            <Label style={{ fontWeight: 'bold' }}>Finance Agent</Label>
          </div>
          <div className="typing-indicator">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        </div>
      </Card>
    </div>
  );
}
