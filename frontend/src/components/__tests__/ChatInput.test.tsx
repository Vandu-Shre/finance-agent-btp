import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  it('should render input field and send button', () => {
    render(<ChatInput onSendMessage={jest.fn()} disabled={false} isWsConnected={true} />);
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('should call onSendMessage when send button is clicked', async () => {
    const handleSend = jest.fn();
    const user = userEvent.setup();

    render(<ChatInput onSendMessage={handleSend} disabled={false} isWsConnected={true} />);

    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Hello');

    const sendButton = screen.getByText('Send');
    await user.click(sendButton);

    expect(handleSend).toHaveBeenCalledWith('Hello');
  });

  it('should call onSendMessage when Enter key is pressed', async () => {
    const handleSend = jest.fn();
    const user = userEvent.setup();

    render(<ChatInput onSendMessage={handleSend} disabled={false} isWsConnected={true} />);

    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Hello{Enter}');

    expect(handleSend).toHaveBeenCalledWith('Hello');
  });

  it('should clear input after sending message', async () => {
    const handleSend = jest.fn();
    const user = userEvent.setup();

    render(<ChatInput onSendMessage={handleSend} disabled={false} isWsConnected={true} />);

    const input = screen.getByPlaceholderText('Type your message...') as HTMLInputElement;
    await user.type(input, 'Hello');

    const sendButton = screen.getByText('Send');
    await user.click(sendButton);

    expect(input.value).toBe('');
  });

  it('should not call onSendMessage for empty message', async () => {
    const handleSend = jest.fn();
    const user = userEvent.setup();

    render(<ChatInput onSendMessage={handleSend} disabled={false} isWsConnected={true} />);

    const sendButton = screen.getByText('Send');
    await user.click(sendButton);

    expect(handleSend).not.toHaveBeenCalled();
  });

  it('should not call onSendMessage for whitespace-only message', async () => {
    const handleSend = jest.fn();
    const user = userEvent.setup();

    render(<ChatInput onSendMessage={handleSend} disabled={false} isWsConnected={true} />);

    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, '   ');

    const sendButton = screen.getByText('Send');
    await user.click(sendButton);

    expect(handleSend).not.toHaveBeenCalled();
  });

  it('should disable input when disabled prop is true', () => {
    render(<ChatInput onSendMessage={jest.fn()} disabled={true} isWsConnected={true} />);
    const input = screen.getByPlaceholderText('Type your message...') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it('should disable send button when disabled prop is true', () => {
    render(<ChatInput onSendMessage={jest.fn()} disabled={true} isWsConnected={true} />);
    const sendButton = screen.getByText('Send') as HTMLButtonElement;
    expect(sendButton).toBeDisabled();
  });

  it('should disable send button when not connected', () => {
    render(<ChatInput onSendMessage={jest.fn()} disabled={false} isWsConnected={false} />);
    const sendButton = screen.getByText('Send') as HTMLButtonElement;
    expect(sendButton).toBeDisabled();
  });
});
