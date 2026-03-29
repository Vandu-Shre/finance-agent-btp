import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';

// Mock the setTheme function from UI5
jest.mock('@ui5/webcomponents-base/dist/config/Theme.js', () => ({
  setTheme: jest.fn(),
}));

// Mock the components to simplify App testing
jest.mock('../../components', () => ({
  Layout: ({ children, onToggleTheme, onNavigate }: any) => (
    <div data-testid="layout">
      <button onClick={onToggleTheme}>Toggle Theme</button>
      <button onClick={() => onNavigate('chat')}>Chat</button>
      <button onClick={() => onNavigate('files')}>Files</button>
      {children}
    </div>
  ),
  ChatView: ({ isDarkMode }: any) => (
    <div data-testid="chat-view">
      Chat View - Dark Mode: {isDarkMode.toString()}
    </div>
  ),
  FilesView: ({ isDarkMode }: any) => (
    <div data-testid="files-view">
      Files View - Dark Mode: {isDarkMode.toString()}
    </div>
  ),
}));

describe('App', () => {
  it('should render the app', () => {
    render(<App />);
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('should render ChatView by default', () => {
    render(<App />);
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
    expect(screen.queryByTestId('files-view')).not.toBeInTheDocument();
  });

  it('should switch to FilesView when files is selected', async () => {
    const user = userEvent.setup();
    render(<App />);

    const filesButton = screen.getByText('Files');
    await user.click(filesButton);

    expect(screen.getByTestId('files-view')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-view')).not.toBeInTheDocument();
  });

  it('should toggle dark mode', async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggleButton = screen.getByText('Toggle Theme');

    // Initially light mode (false)
    expect(screen.getByText(/Dark Mode: false/)).toBeInTheDocument();

    // Toggle to dark mode
    await user.click(toggleButton);
    expect(screen.getByText(/Dark Mode: true/)).toBeInTheDocument();

    // Toggle back to light mode
    await user.click(toggleButton);
    expect(screen.getByText(/Dark Mode: false/)).toBeInTheDocument();
  });

  it('should pass isDarkMode prop to views', async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggleButton = screen.getByText('Toggle Theme');
    await user.click(toggleButton);

    expect(screen.getByText('Chat View - Dark Mode: true')).toBeInTheDocument();
  });
});
