import { Title, Button } from '@ui5/webcomponents-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  buttonText?: string;
  buttonIcon?: string;
  onButtonClick?: () => void;
  isDarkMode: boolean;
}

export function Header({ title, subtitle, buttonText, buttonIcon, onButtonClick, isDarkMode }: HeaderProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 2rem',
      backgroundColor: isDarkMode ? '#1d232a' : 'white',
      borderBottom: isDarkMode ? '1px solid #2c3540' : '1px solid #e5e5e5'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
        <Title level="H3">{title}</Title>
        {subtitle && (
          <span style={{
            fontSize: '0.75rem',
            color: isDarkMode ? '#8a9bb0' : '#6c757d',
            fontFamily: 'monospace'
          }}>
            {subtitle}
          </span>
        )}
      </div>
      {buttonText && (
        <Button
          icon={buttonIcon}
          design="Emphasized"
          onClick={onButtonClick}
        >
          {buttonText}
        </Button>
      )}
    </div>
  );
}
