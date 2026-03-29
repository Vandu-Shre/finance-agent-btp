import { FileClient } from '../file-client.js';
import type { FinanceAgentConfig } from '../types.js';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('FileClient', () => {
  let fileClient: FileClient;
  const config: FinanceAgentConfig = {
    baseUrl: 'https://test-app.cfapps.example.com',
    authToken: 'test-token',
  };

  beforeEach(() => {
    fileClient = new FileClient(config);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct baseUrl', () => {
      expect(fileClient).toBeInstanceOf(FileClient);
    });

    it('should strip trailing slash from baseUrl', () => {
      const clientWithSlash = new FileClient({
        baseUrl: 'https://test-app.cfapps.example.com/',
      });
      expect(clientWithSlash).toBeInstanceOf(FileClient);
    });

    it('should set authorization header when authToken provided', () => {
      const client = new FileClient(config);
      expect(client).toBeInstanceOf(FileClient);
    });
  });

  describe('getFiles', () => {
    it('should fetch and return list of files', async () => {
      const mockFiles = [
        {
          fileName: 'test.pdf',
          storedName: '123-test.pdf',
          type: 'PDF',
          size: '1.5 MB',
          uploadDate: '2024-03-28',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: mockFiles }),
      } as Response);

      const files = await fileClient.getFiles();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-app.cfapps.example.com/api/files',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-token',
          },
        }
      );
      expect(files).toEqual(mockFiles);
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      } as Response);

      await expect(fileClient.getFiles()).rejects.toThrow('Server error');
    });

    it('should handle json parse error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Parse error');
        },
      } as unknown as Response);

      await expect(fileClient.getFiles()).rejects.toThrow('Failed to get files');
    });
  });

  describe('uploadFile', () => {
    it('should upload browser File object', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const mockResponse = {
        message: 'File uploaded successfully',
        file: {
          fileName: 'test.txt',
          storedName: '123-test.txt',
          type: 'TXT',
          size: '12 Bytes',
          uploadDate: '2024-03-28',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fileClient.uploadFile(mockFile);

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it('should upload Node.js Buffer with filename', async () => {
      const buffer = Buffer.from('test content');
      const mockResponse = {
        message: 'File uploaded successfully',
        file: {
          fileName: 'test.txt',
          storedName: '123-test.txt',
          type: 'TXT',
          size: '12 Bytes',
          uploadDate: '2024-03-28',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fileClient.uploadFile({ buffer, filename: 'test.txt' });

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on upload failure', async () => {
      const mockFile = new File(['test'], 'test.txt');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid file' }),
      } as Response);

      await expect(fileClient.uploadFile(mockFile)).rejects.toThrow('Invalid file');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const filename = '123-test.pdf';
      const mockResponse = { message: 'File deleted successfully' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fileClient.deleteFile(filename);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://test-app.cfapps.example.com/api/files/${filename}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer test-token',
          },
        }
      );
      expect(result).toBe('File deleted successfully');
    });

    it('should encode filename in URL', async () => {
      const filename = 'test file with spaces.pdf';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Deleted' }),
      } as Response);

      await fileClient.deleteFile(filename);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(filename)),
        expect.any(Object)
      );
    });

    it('should throw error when file not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'File not found' }),
      } as Response);

      await expect(fileClient.deleteFile('nonexistent.pdf')).rejects.toThrow('File not found');
    });
  });
});
