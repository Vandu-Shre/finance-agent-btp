import { render, screen } from '@testing-library/react';
import { FileList } from '../FileList';
import { FileInfo } from '../../api';

describe('FileList', () => {
  const mockFiles: FileInfo[] = [
    {
      fileName: 'document.pdf',
      storedName: 'stored-123.pdf',
      type: 'PDF',
      size: '1.2 MB',
      uploadDate: '2024-03-28',
    },
    {
      fileName: 'spreadsheet.xlsx',
      storedName: 'stored-456.xlsx',
      type: 'Excel',
      size: '500 KB',
      uploadDate: '2024-03-27',
    },
  ];

  it('should render loading state', () => {
    render(
      <FileList
        files={[]}
        isLoading={true}
        onDeleteFile={jest.fn()}
        isDarkMode={false}
      />
    );
    expect(screen.getByText('Loading files...')).toBeInTheDocument();
  });

  it('should render empty state', () => {
    render(
      <FileList
        files={[]}
        isLoading={false}
        onDeleteFile={jest.fn()}
        isDarkMode={false}
      />
    );
    expect(screen.getByText('No files uploaded yet. Click "Upload File" to get started.')).toBeInTheDocument();
  });

  it('should render file list table', () => {
    render(
      <FileList
        files={mockFiles}
        isLoading={false}
        onDeleteFile={jest.fn()}
        isDarkMode={false}
      />
    );
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('spreadsheet.xlsx')).toBeInTheDocument();
  });

  it('should render file details', () => {
    render(
      <FileList
        files={mockFiles}
        isLoading={false}
        onDeleteFile={jest.fn()}
        isDarkMode={false}
      />
    );
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('1.2 MB')).toBeInTheDocument();
    expect(screen.getByText('2024-03-28')).toBeInTheDocument();
  });

  it('should apply dark mode styles', () => {
    const { container } = render(
      <FileList
        files={mockFiles}
        isLoading={false}
        onDeleteFile={jest.fn()}
        isDarkMode={true}
      />
    );
    const listContainer = container.firstChild as HTMLElement;
    expect(listContainer).toHaveStyle({ backgroundColor: '#12171c' });
  });

  it('should apply light mode styles', () => {
    const { container } = render(
      <FileList
        files={mockFiles}
        isLoading={false}
        onDeleteFile={jest.fn()}
        isDarkMode={false}
      />
    );
    const listContainer = container.firstChild as HTMLElement;
    expect(listContainer).toHaveStyle({ backgroundColor: '#f5f5f5' });
  });
});
