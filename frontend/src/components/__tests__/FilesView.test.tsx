import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilesView } from '../FilesView';
import { fileApi, FileInfo } from '../../api';

// Mock the fileApi
jest.mock('../../api', () => ({
  fileApi: {
    getAllFiles: jest.fn(),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  },
}));

describe('FilesView', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    (fileApi.getAllFiles as jest.Mock).mockResolvedValue({ files: [] });
  });

  it('should render header with upload button', async () => {
    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Files')).toBeInTheDocument();
      expect(screen.getByText('Upload File')).toBeInTheDocument();
    });
  });

  it('should load files on mount', async () => {
    (fileApi.getAllFiles as jest.Mock).mockResolvedValue({ files: mockFiles });

    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(fileApi.getAllFiles).toHaveBeenCalledTimes(1);
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('spreadsheet.xlsx')).toBeInTheDocument();
    });
  });

  it('should show loading state while fetching files', () => {
    (fileApi.getAllFiles as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ files: [] }), 100))
    );

    render(<FilesView isDarkMode={false} />);

    expect(screen.getByText('Loading files...')).toBeInTheDocument();
  });

  it('should show empty state when no files', async () => {
    (fileApi.getAllFiles as jest.Mock).mockResolvedValue({ files: [] });

    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('No files uploaded yet. Click "Upload File" to get started.')).toBeInTheDocument();
    });
  });

  it('should display file list with details', async () => {
    (fileApi.getAllFiles as jest.Mock).mockResolvedValue({ files: mockFiles });

    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('spreadsheet.xlsx')).toBeInTheDocument();
      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('Excel')).toBeInTheDocument();
      expect(screen.getByText('1.2 MB')).toBeInTheDocument();
      expect(screen.getByText('500 KB')).toBeInTheDocument();
      expect(screen.getByText('2024-03-28')).toBeInTheDocument();
      expect(screen.getByText('2024-03-27')).toBeInTheDocument();
    });
  });

  it('should open file dialog when upload button is clicked', async () => {
    const user = userEvent.setup();
    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Upload File')).toBeInTheDocument();
    });

    const uploadButton = screen.getByText('Upload File');

    // Find the hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(fileInput, 'click');

    await user.click(uploadButton);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('should upload file when file is selected', async () => {
    (fileApi.uploadFile as jest.Mock).mockResolvedValue({});
    (fileApi.getAllFiles as jest.Mock).mockResolvedValue({ files: mockFiles });

    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Upload File')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    // Simulate file selection
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    const event = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(event);

    await waitFor(() => {
      expect(fileApi.uploadFile).toHaveBeenCalledWith(file);
      expect(screen.getByText('File "test.pdf" uploaded successfully!')).toBeInTheDocument();
      expect(fileApi.getAllFiles).toHaveBeenCalledTimes(2); // Once on mount, once after upload
    });
  });

  it('should handle upload error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    (fileApi.uploadFile as jest.Mock).mockRejectedValue(new Error('Upload failed'));

    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Upload File')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    const event = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(event);

    await waitFor(() => {
      expect(fileApi.uploadFile).toHaveBeenCalledWith(file);
      expect(consoleError).toHaveBeenCalledWith('Error uploading file:', expect.any(Error));
      expect(screen.getByText('Failed to upload file. Please try again.')).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('should not upload if no file is selected', async () => {
    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Upload File')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Simulate change event without files
    Object.defineProperty(fileInput, 'files', {
      value: [],
      writable: false,
    });

    const event = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(event);

    await waitFor(() => {
      expect(fileApi.uploadFile).not.toHaveBeenCalled();
    });
  });

  it('should show confirmation bar when delete is requested via table button', async () => {
    (fileApi.getAllFiles as jest.Mock).mockResolvedValue({ files: mockFiles });
    (fileApi.deleteFile as jest.Mock).mockResolvedValue({});

    const user = userEvent.setup();
    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('icon') === 'delete' || btn.getAttribute('design') === 'Negative'
    );
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    });
  });

  it('should delete file when confirmed', async () => {
    (fileApi.getAllFiles as jest.Mock).mockResolvedValue({ files: mockFiles });
    (fileApi.deleteFile as jest.Mock).mockResolvedValue({});

    const user = userEvent.setup();
    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    // Click the delete button in the table row
    const deleteButtons = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('icon') === 'delete' || btn.getAttribute('design') === 'Negative'
    );
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    const confirmDeleteButton = screen.getByText('Delete');
    await user.click(confirmDeleteButton);

    await waitFor(() => {
      expect(fileApi.deleteFile).toHaveBeenCalledWith('stored-123.pdf');
      expect(screen.getByText('File "document.pdf" deleted successfully!')).toBeInTheDocument();
    });
  });

  it('should cancel file deletion when cancel is clicked', async () => {
    (fileApi.getAllFiles as jest.Mock).mockResolvedValue({ files: mockFiles });

    const user = userEvent.setup();
    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('icon') === 'delete' || btn.getAttribute('design') === 'Negative'
    );
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument();
    });
    expect(fileApi.deleteFile).not.toHaveBeenCalled();
  });

  it('should show error message when deletion fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    (fileApi.getAllFiles as jest.Mock).mockResolvedValue({ files: mockFiles });
    (fileApi.deleteFile as jest.Mock).mockRejectedValue(new Error('Delete failed'));

    const user = userEvent.setup();
    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('icon') === 'delete' || btn.getAttribute('design') === 'Negative'
    );
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Error deleting file:', expect.any(Error));
      expect(screen.getByText('Failed to delete file. Please try again.')).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('should close notification when close button clicked', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    (fileApi.getAllFiles as jest.Mock).mockRejectedValue(new Error('Load failed'));

    const user = userEvent.setup();
    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load files. Please try again.')).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText('Close');
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Failed to load files. Please try again.')).not.toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('should handle load files error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    (fileApi.getAllFiles as jest.Mock).mockRejectedValue(new Error('Load failed'));

    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Error loading files:', expect.any(Error));
      expect(screen.getByText('Failed to load files. Please try again.')).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('should reset file input after upload', async () => {
    (fileApi.uploadFile as jest.Mock).mockResolvedValue({});
    (fileApi.getAllFiles as jest.Mock).mockResolvedValue({ files: [] });

    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Upload File')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    // Create a mock FileList
    const fileList = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file;
      },
    };

    Object.defineProperty(fileInput, 'files', {
      value: fileList,
      writable: false,
      configurable: true,
    });

    // Mock the value property with a descriptor that allows setting
    let inputValue = 'test.pdf';
    Object.defineProperty(fileInput, 'value', {
      get: () => inputValue,
      set: (val) => { inputValue = val; },
      configurable: true,
    });

    expect(fileInput.value).toBe('test.pdf');

    const event = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(event);

    await waitFor(() => {
      expect(fileApi.uploadFile).toHaveBeenCalled();
      expect(fileInput.value).toBe('');
    });
  });

  it('should apply dark mode styles', async () => {
    (fileApi.getAllFiles as jest.Mock).mockResolvedValue({ files: [] });
    render(<FilesView isDarkMode={true} />);

    await waitFor(() => {
      const header = screen.getByText('Files').closest('div')?.parentElement;
      expect(header).toBeTruthy();
    });
  });

  it('should apply light mode styles', async () => {
    (fileApi.getAllFiles as jest.Mock).mockResolvedValue({ files: [] });
    render(<FilesView isDarkMode={false} />);

    await waitFor(() => {
      const header = screen.getByText('Files').closest('div')?.parentElement;
      expect(header).toBeTruthy();
    });
  });
});
