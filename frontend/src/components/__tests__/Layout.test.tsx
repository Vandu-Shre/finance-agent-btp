import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Layout } from '../Layout';

describe('Layout', () => {
  const defaultProps = {
    children: <div>Test Content</div>,
    collapsed: false,
    selectedKey: 'chat',
    isDarkMode: false,
    onToggleSidebar: jest.fn(),
    onNavigate: jest.fn(),
    onToggleTheme: jest.fn(),
  };

  it('should render children content', () => {
    render(<Layout {...defaultProps} />);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render primary title', () => {
    render(<Layout {...defaultProps} />);
    expect(screen.getByText('Finance Agent')).toBeInTheDocument();
  });

  it('should render navigation items', () => {
    render(<Layout {...defaultProps} />);
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('should render user avatar', () => {
    render(<Layout {...defaultProps} />);
    expect(screen.getByText('JM')).toBeInTheDocument();
  });

  it('should call onToggleSidebar when menu button is clicked', async () => {
    const handleToggle = jest.fn();
    const user = userEvent.setup();

    render(<Layout {...defaultProps} onToggleSidebar={handleToggle} />);

    const menuButton = screen.getAllByRole('button')[0];
    await user.click(menuButton);

    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('should call onToggleTheme when theme button is clicked', async () => {
    const handleToggleTheme = jest.fn();
    const user = userEvent.setup();

    render(<Layout {...defaultProps} onToggleTheme={handleToggleTheme} />);

    // Find the theme toggle button (second button in the ShellBar)
    const buttons = screen.getAllByRole('button');
    const themeButton = buttons.find(btn =>
      btn.getAttribute('tooltip') === 'Switch to Dark Mode' ||
      btn.getAttribute('tooltip') === 'Switch to Light Mode'
    );

    if (themeButton) {
      await user.click(themeButton);
      expect(handleToggleTheme).toHaveBeenCalledTimes(1);
    }
  });

  it('should mark chat as selected when selectedKey is chat', () => {
    render(<Layout {...defaultProps} selectedKey="chat" />);
    const chatItem = screen.getByText('Chat').closest('[data-key="chat"]');
    expect(chatItem).toHaveAttribute('data-selected', 'true');
  });

  it('should mark files as selected when selectedKey is files', () => {
    render(<Layout {...defaultProps} selectedKey="files" />);
    const filesItem = screen.getByText('Files').closest('[data-key="files"]');
    expect(filesItem).toHaveAttribute('data-selected', 'true');
  });
});
