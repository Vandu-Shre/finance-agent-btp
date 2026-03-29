import { render, screen } from '@testing-library/react';
import { TypingIndicator } from '../TypingIndicator';

describe('TypingIndicator', () => {
  it('should render Finance Agent label', () => {
    render(<TypingIndicator isDarkMode={false} />);
    expect(screen.getByText('Finance Agent')).toBeInTheDocument();
  });

  it('should render typing dots', () => {
    const { container } = render(<TypingIndicator isDarkMode={false} />);
    const typingDots = container.querySelectorAll('.typing-dot');
    expect(typingDots).toHaveLength(3);
  });

  it('should apply dark mode styles', () => {
    const { container } = render(<TypingIndicator isDarkMode={true} />);
    const card = container.querySelector('[style*="background-color"]') as HTMLElement;
    expect(card).toHaveStyle({ backgroundColor: '#2c3540' });
  });

  it('should apply light mode styles', () => {
    const { container } = render(<TypingIndicator isDarkMode={false} />);
    const card = container.querySelector('[style*="background-color"]') as HTMLElement;
    expect(card).toHaveStyle({ backgroundColor: '#f5f5f5' });
  });

  it('should render with correct alignment', () => {
    const { container } = render(<TypingIndicator isDarkMode={false} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ justifyContent: 'flex-start' });
  });
});
