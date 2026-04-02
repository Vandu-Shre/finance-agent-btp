import { render, screen } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';
import { Message } from '../../api';

describe('ChatMessage', () => {
  const userMessage: Message = {
    id: 'msg-1',
    sessionId: 'session-test',
    text: 'Hello, how are you?',
    sender: 'user',
    timestamp: new Date().toISOString(),
  };

  const agentMessage: Message = {
    id: 'msg-2',
    sessionId: 'session-test',
    text: 'I am doing well, thank you!',
    sender: 'agent',
    timestamp: new Date().toISOString(),
  };

  it('should render user message', () => {
    render(<ChatMessage message={userMessage} isDarkMode={false} />);
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('should render agent message', () => {
    render(<ChatMessage message={agentMessage} isDarkMode={false} />);
    expect(screen.getByText('I am doing well, thank you!')).toBeInTheDocument();
    expect(screen.getByText('Finance Agent')).toBeInTheDocument();
  });

  it('should display user avatar with initials', () => {
    render(<ChatMessage message={userMessage} isDarkMode={false} />);
    expect(screen.getByText('JM')).toBeInTheDocument();
  });

  it('should apply correct alignment for user message', () => {
    const { container } = render(<ChatMessage message={userMessage} isDarkMode={false} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ justifyContent: 'flex-end' });
  });

  it('should apply correct alignment for agent message', () => {
    const { container } = render(<ChatMessage message={agentMessage} isDarkMode={false} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ justifyContent: 'flex-start' });
  });

  it('should apply dark mode styles for user message', () => {
    const { container } = render(<ChatMessage message={userMessage} isDarkMode={true} />);
    const card = container.querySelector('[style*="background-color"]') as HTMLElement;
    expect(card).toHaveStyle({ backgroundColor: '#2c3540' });
  });

  it('should apply light mode styles for user message', () => {
    const { container } = render(<ChatMessage message={userMessage} isDarkMode={false} />);
    const card = container.querySelector('[style*="background-color"]') as HTMLElement;
    expect(card).toHaveStyle({ backgroundColor: '#e3f2fd' });
  });

  describe('system messages', () => {
    const systemMessage: Message = {
      id: 'sys-1',
      sessionId: 'session-test',
      text: 'Session started',
      sender: 'system',
      timestamp: new Date().toISOString(),
    };

    it('should render system message text', () => {
      render(<ChatMessage message={systemMessage} isDarkMode={false} />);
      expect(screen.getByText('Session started')).toBeInTheDocument();
    });

    it('should apply centered layout for system messages', () => {
      const { container } = render(<ChatMessage message={systemMessage} isDarkMode={false} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ justifyContent: 'center' });
    });

    it('should apply dark mode styles for system messages', () => {
      const { container } = render(<ChatMessage message={systemMessage} isDarkMode={true} />);
      const card = container.querySelector('[style*="background-color"]') as HTMLElement;
      expect(card).toHaveStyle({ backgroundColor: '#1f2830' });
    });

    it('should apply light mode styles for system messages', () => {
      const { container } = render(<ChatMessage message={systemMessage} isDarkMode={false} />);
      const card = container.querySelector('[style*="background-color"]') as HTMLElement;
      expect(card).toHaveStyle({ backgroundColor: '#e8f5e9' });
    });

    it('should render file-added icon for file-added metadata', () => {
      const fileAddedMsg: Message = {
        ...systemMessage,
        metadata: { type: 'file-added' },
      };
      render(<ChatMessage message={fileAddedMsg} isDarkMode={false} />);
      const icon = document.querySelector('ui5-icon');
      expect(icon).toHaveAttribute('name', 'document');
    });

    it('should render delete icon for file-deleted metadata', () => {
      const fileDeletedMsg: Message = {
        ...systemMessage,
        metadata: { type: 'file-deleted' },
      };
      render(<ChatMessage message={fileDeletedMsg} isDarkMode={false} />);
      const icon = document.querySelector('ui5-icon');
      expect(icon).toHaveAttribute('name', 'delete');
    });

    it('should render folder icon for files-loaded metadata', () => {
      const filesLoadedMsg: Message = {
        ...systemMessage,
        metadata: { type: 'files-loaded' },
      };
      render(<ChatMessage message={filesLoadedMsg} isDarkMode={false} />);
      const icon = document.querySelector('ui5-icon');
      expect(icon).toHaveAttribute('name', 'folder');
    });

    it('should render information icon for unknown metadata type', () => {
      const infoMsg: Message = {
        ...systemMessage,
        metadata: { type: 'unknown' },
      };
      render(<ChatMessage message={infoMsg} isDarkMode={false} />);
      const icon = document.querySelector('ui5-icon');
      expect(icon).toHaveAttribute('name', 'information');
    });
  });
});
