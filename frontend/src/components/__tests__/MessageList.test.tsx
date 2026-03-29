import { render, screen } from '@testing-library/react';
import { MessageList } from '../MessageList';
import { Message } from '../../api';

describe('MessageList', () => {
  const mockMessages: Message[] = [
    {
      id: 'msg-1',
      sessionId: 'session-test',
      text: 'Hello',
      sender: 'user',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'msg-2',
      sessionId: 'session-test',
      text: 'Hi there!',
      sender: 'agent',
      timestamp: new Date().toISOString(),
    },
  ];

  it('should render loading state', () => {
    render(
      <MessageList
        messages={[]}
        isLoading={true}
        isAgentTyping={false}
        isDarkMode={false}
      />
    );
    expect(screen.getByText('Loading messages...')).toBeInTheDocument();
  });

  it('should render empty state', () => {
    render(
      <MessageList
        messages={[]}
        isLoading={false}
        isAgentTyping={false}
        isDarkMode={false}
      />
    );
    expect(screen.getByText('No messages yet. Start a conversation!')).toBeInTheDocument();
  });

  it('should render messages', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        isAgentTyping={false}
        isDarkMode={false}
      />
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('should render typing indicator when agent is typing', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        isAgentTyping={true}
        isDarkMode={false}
      />
    );
    const typingDots = document.querySelectorAll('.typing-dot');
    expect(typingDots).toHaveLength(3);
  });

  it('should not render typing indicator when agent is not typing', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        isAgentTyping={false}
        isDarkMode={false}
      />
    );
    const typingDots = document.querySelectorAll('.typing-dot');
    expect(typingDots).toHaveLength(0);
  });

  it('should apply dark mode styles', () => {
    const { container } = render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        isAgentTyping={false}
        isDarkMode={true}
      />
    );
    const messagesContainer = container.firstChild as HTMLElement;
    expect(messagesContainer).toHaveStyle({ backgroundColor: '#12171c' });
  });

  it('should apply light mode styles', () => {
    const { container } = render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        isAgentTyping={false}
        isDarkMode={false}
      />
    );
    const messagesContainer = container.firstChild as HTMLElement;
    expect(messagesContainer).toHaveStyle({ backgroundColor: '#f5f5f5' });
  });
});
