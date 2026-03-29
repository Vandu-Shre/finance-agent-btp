// Mock db.service before importing file.service
jest.mock('../../services/db.service.js', () => ({
  query: jest.fn(),
  persist: jest.fn(),
}));

import { FileService } from '../../services/file.service.js';
import { query, persist } from '../../services/db.service.js';

const mockQuery = query as jest.Mock;
const mockPersist = persist as jest.Mock;

describe('FileService', () => {
  let fileService: FileService;

  beforeEach(() => {
    jest.clearAllMocks();
    fileService = new FileService();
  });

  describe('processUploadedFile', () => {
    it('should return file metadata with a unique stored name', () => {
      const mockFile = {
        originalname: 'test-document.pdf',
        buffer: Buffer.from('test content'),
        mimetype: 'application/pdf',
        size: 2048,
      } as Express.Multer.File;

      const result = fileService.processUploadedFile(mockFile);

      expect(result.fileName).toBe('test-document.pdf');
      expect(result.storedName).toMatch(/^\d+-\d+-test-document\.pdf$/);
      expect(result.type).toBe('PDF');
      expect(result.size).toBe('2 KB');
      expect(result.uploadDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle files without extension', () => {
      const mockFile = {
        originalname: 'README',
        buffer: Buffer.from('readme content'),
        mimetype: 'text/plain',
        size: 1024,
      } as Express.Multer.File;

      const result = fileService.processUploadedFile(mockFile);

      expect(result.type).toBe('Unknown');
    });

    it('should format file size correctly', () => {
      const testCases = [
        { size: 0, expected: '0 Bytes' },
        { size: 500, expected: '500 Bytes' },
        { size: 1024, expected: '1 KB' },
        { size: 1536, expected: '1.5 KB' },
        { size: 1048576, expected: '1 MB' },
        { size: 5242880, expected: '5 MB' },
      ];

      testCases.forEach(({ size, expected }) => {
        const mockFile = {
          originalname: 'test.txt',
          buffer: Buffer.from('test'),
          mimetype: 'text/plain',
          size,
        } as Express.Multer.File;

        expect(fileService.processUploadedFile(mockFile).size).toBe(expected);
      });
    });

    it('should not store anything (no DB call)', () => {
      const mockFile = {
        originalname: 'test.txt',
        buffer: Buffer.from('test content'),
        mimetype: 'text/plain',
        size: 1024,
      } as Express.Multer.File;

      fileService.processUploadedFile(mockFile);

      expect(mockPersist).not.toHaveBeenCalled();
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('saveUpload', () => {
    it('should call persist with correct INSERT statement', () => {
      const mockFile = {
        originalname: 'report.pdf',
        mimetype: 'application/pdf',
        size: 2048,
      } as Express.Multer.File;

      fileService.saveUpload(mockFile, 'stored-report.pdf', 'session-123');

      expect(mockPersist).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO files'),
        expect.arrayContaining(['session-123', 'report.pdf', 'stored-report.pdf', 'application/pdf', 2048])
      );
    });
  });

  describe('getAllFiles', () => {
    it('should return empty array when no files in DB', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await fileService.getAllFiles();

      expect(result).toEqual([]);
    });

    it('should map DB rows to FileInfo objects', async () => {
      mockQuery.mockResolvedValue([
        { file_name: 'report.pdf', stored_name: '123-report.pdf', size_bytes: 2048, upload_date: new Date('2024-01-15') },
        { file_name: 'data.csv', stored_name: '456-data.csv', size_bytes: 1024, upload_date: new Date('2024-01-16') },
      ]);

      const result = await fileService.getAllFiles();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ fileName: 'report.pdf', storedName: '123-report.pdf', type: 'PDF', size: '2 KB' });
      expect(result[1]).toMatchObject({ fileName: 'data.csv', storedName: '456-data.csv', type: 'CSV', size: '1 KB' });
    });

    it('should handle files without extension', async () => {
      mockQuery.mockResolvedValue([
        { file_name: 'README', stored_name: '789-README', size_bytes: 512, upload_date: new Date() },
      ]);

      const result = await fileService.getAllFiles();

      expect(result[0]?.type).toBe('Unknown');
    });
  });

  describe('deleteFile', () => {
    it('should return not found when file does not exist in DB', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await fileService.deleteFile('non-existent.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });

    it('should delete file and return originalName on success', async () => {
      mockQuery
        .mockResolvedValueOnce([{ file_name: 'report.pdf' }])
        .mockResolvedValueOnce([]);

      const result = await fileService.deleteFile('stored-report.pdf');

      expect(result.success).toBe(true);
      expect(result.originalName).toBe('report.pdf');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should issue DELETE query with correct stored name', async () => {
      mockQuery
        .mockResolvedValueOnce([{ file_name: 'test.txt' }])
        .mockResolvedValueOnce([]);

      await fileService.deleteFile('stored-test.txt');

      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        'DELETE FROM files WHERE stored_name = $1',
        ['stored-test.txt']
      );
    });
  });

  describe('File size formatting edge cases', () => {
    it('should handle very large files', () => {
      const mockFile = {
        originalname: 'large.zip',
        buffer: Buffer.from('large'),
        mimetype: 'application/zip',
        size: 1073741824, // 1 GB
      } as Express.Multer.File;

      expect(fileService.processUploadedFile(mockFile).size).toBe('1 GB');
    });

    it('should round to 2 decimal places', () => {
      const mockFile = {
        originalname: 'test.txt',
        buffer: Buffer.from('test'),
        mimetype: 'text/plain',
        size: 1536, // 1.5 KB
      } as Express.Multer.File;

      expect(fileService.processUploadedFile(mockFile).size).toBe('1.5 KB');
    });
  });
});
