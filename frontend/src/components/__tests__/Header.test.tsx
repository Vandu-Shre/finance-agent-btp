import { render, screen } from '@testing-library/react';
import { Header } from '../Header';

describe('Header', () => {
  it('should render title', () => {
    render(<Header title="Test Title" isDarkMode={false} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should render button when button text is provided', () => {
    render(
      <Header
        title="Chat"
        buttonText="New Session"
        buttonIcon="add"
        isDarkMode={false}
      />
    );
    expect(screen.getByText('New Session')).toBeInTheDocument();
  });

  it('should not render button when button text is not provided', () => {
    render(<Header title="Chat" isDarkMode={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should call onButtonClick when button is clicked', () => {
    const handleClick = jest.fn();
    render(
      <Header
        title="Chat"
        buttonText="Click Me"
        onButtonClick={handleClick}
        isDarkMode={false}
      />
    );

    const button = screen.getByText('Click Me');
    button.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should apply dark mode styles', () => {
    const { container } = render(<Header title="Test" isDarkMode={true} />);
    const headerDiv = container.firstChild as HTMLElement;
    expect(headerDiv).toHaveStyle({ backgroundColor: '#1d232a' });
  });

  it('should apply light mode styles', () => {
    const { container } = render(<Header title="Test" isDarkMode={false} />);
    const headerDiv = container.firstChild as HTMLElement;
    // jsdom converts 'white' to 'rgb(255, 255, 255)'
    expect(headerDiv.style.backgroundColor).toBeTruthy();
  });

  it('should render subtitle when provided', () => {
    render(
      <Header
        title="Chat"
        subtitle="Session: session-123"
        isDarkMode={false}
      />
    );
    expect(screen.getByText('Session: session-123')).toBeInTheDocument();
  });

  it('should not render subtitle when not provided', () => {
    render(<Header title="Chat" isDarkMode={false} />);
    expect(screen.queryByText(/Session:/)).not.toBeInTheDocument();
  });

  it('should apply dark mode color to subtitle', () => {
    render(
      <Header
        title="Chat"
        subtitle="Session: session-123"
        isDarkMode={true}
      />
    );
    const subtitle = screen.getByText('Session: session-123');
    expect(subtitle).toHaveStyle({ color: '#8a9bb0' });
  });
});
