// Mock db.service before importing file.service
const mockFileCreate = jest.fn().mockResolvedValue({});
const mockFileFindMany = jest.fn().mockResolvedValue([]);
const mockFileFindFirst = jest.fn().mockResolvedValue(null);
const mockFileDelete = jest.fn().mockResolvedValue({});

jest.mock('../../services/db.service.js', () => ({
  prisma: {
    file: {
      create: mockFileCreate,
      findMany: mockFileFindMany,
      findFirst: mockFileFindFirst,
      delete: mockFileDelete,
    },
  },
}));

import { FileService } from '../../services/file.service.js';

describe('FileService', () => {
  let fileService: FileService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileCreate.mockResolvedValue({});
    mockFileFindMany.mockResolvedValue([]);
    mockFileFindFirst.mockResolvedValue(null);
    mockFileDelete.mockResolvedValue({});
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

      expect(mockFileCreate).not.toHaveBeenCalled();
      expect(mockFileFindMany).not.toHaveBeenCalled();
    });
  });

  describe('saveUpload', () => {
    it('should call prisma.file.create with correct data', () => {
      const mockFile = {
        originalname: 'report.pdf',
        mimetype: 'application/pdf',
        size: 2048,
      } as Express.Multer.File;

      fileService.saveUpload(mockFile, 'stored-report.pdf', 'session-123');

      expect(mockFileCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: 'session-123',
          fileName: 'report.pdf',
          storedName: 'stored-report.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
        }),
      });
    });
  });

  describe('getAllFiles', () => {
    it('should return empty array when no files in DB', async () => {
      mockFileFindMany.mockResolvedValue([]);

      const result = await fileService.getAllFiles();

      expect(result).toEqual([]);
    });

    it('should map DB rows to FileInfo objects', async () => {
      mockFileFindMany.mockResolvedValue([
        { fileName: 'report.pdf', storedName: '123-report.pdf', sizeBytes: 2048, uploadDate: new Date('2024-01-15') },
        { fileName: 'data.csv', storedName: '456-data.csv', sizeBytes: 1024, uploadDate: new Date('2024-01-16') },
      ]);

      const result = await fileService.getAllFiles();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ fileName: 'report.pdf', storedName: '123-report.pdf', type: 'PDF', size: '2 KB' });
      expect(result[1]).toMatchObject({ fileName: 'data.csv', storedName: '456-data.csv', type: 'CSV', size: '1 KB' });
    });

    it('should handle files without extension', async () => {
      mockFileFindMany.mockResolvedValue([
        { fileName: 'README', storedName: '789-README', sizeBytes: 512, uploadDate: new Date() },
      ]);

      const result = await fileService.getAllFiles();

      expect(result[0]?.type).toBe('Unknown');
    });
  });

  describe('deleteFile', () => {
    it('should return not found when file does not exist in DB', async () => {
      mockFileFindFirst.mockResolvedValue(null);

      const result = await fileService.deleteFile('non-existent.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });

    it('should delete file and return originalName on success', async () => {
      mockFileFindFirst.mockResolvedValue({ fileName: 'report.pdf', storedName: 'stored-report.pdf' });

      const result = await fileService.deleteFile('stored-report.pdf');

      expect(result.success).toBe(true);
      expect(result.originalName).toBe('report.pdf');
      expect(mockFileDelete).toHaveBeenCalledWith({ where: { storedName: 'stored-report.pdf' } });
    });

    it('should not call delete when file is not found', async () => {
      mockFileFindFirst.mockResolvedValue(null);

      await fileService.deleteFile('missing.pdf');

      expect(mockFileDelete).not.toHaveBeenCalled();
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
