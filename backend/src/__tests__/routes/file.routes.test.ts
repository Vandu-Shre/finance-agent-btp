import request from 'supertest';
import express from 'express';

jest.mock('../../services/chat.service.js', () => ({
  __esModule: true,
  default: {
    indexDocument: jest.fn().mockResolvedValue(undefined),
    isVectorStoreReady: jest.fn().mockReturnValue(true),
    addFileUploadedMessage: jest.fn(),
    addFileDeletedMessage: jest.fn(),
  },
}));

jest.mock('../../services/file.service.js', () => ({
  __esModule: true,
  default: {
    processUploadedFile: jest.fn().mockReturnValue({
      fileName: 'test.txt',
      storedName: 'stored-test.txt',
      type: 'TXT',
      size: '19 Bytes',
      uploadDate: '2024-01-01',
    }),
    saveUpload: jest.fn(),
    getAllFiles: jest.fn().mockResolvedValue([]),
    deleteFile: jest.fn().mockResolvedValue({ success: false, error: 'File not found' }),
  },
}));

jest.mock('../../agent/index.js', () => ({
  deleteDocumentByFilename: jest.fn().mockResolvedValue(undefined),
}));

import fileRoutes from '../../routes/file.routes.js';
import fileService from '../../services/file.service.js';
import { deleteDocumentByFilename } from '../../agent/index.js';

const app = express();
app.use(express.json());
app.use('/api/files', fileRoutes);

describe('File Management API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fileService.processUploadedFile as jest.Mock).mockReturnValue({
      fileName: 'test.txt',
      storedName: 'stored-test.txt',
      type: 'TXT',
      size: '19 Bytes',
      uploadDate: '2024-01-01',
    });
    (fileService.getAllFiles as jest.Mock).mockResolvedValue([]);
    (fileService.deleteFile as jest.Mock).mockResolvedValue({ success: false, error: 'File not found' });
  });

  describe('POST /api/files - Upload File', () => {
    it('should upload a file successfully', async () => {
      const response = await request(app)
        .post('/api/files')
        .attach('file', Buffer.from('This is a test file'), 'test.txt');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('File uploaded and indexed successfully');
      expect(response.body.file).toMatchObject({ fileName: 'test.txt', type: 'TXT', storedName: 'stored-test.txt' });
    });

    it('should return 400 when no file is provided', async () => {
      const response = await request(app).post('/api/files');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'No file uploaded');
    });

    it('should call saveUpload with the session ID header', async () => {
      await request(app)
        .post('/api/files')
        .set('x-session-id', 'session-xyz')
        .attach('file', Buffer.from('content'), 'test.txt');

      expect(fileService.saveUpload).toHaveBeenCalledWith(
        expect.anything(),
        'stored-test.txt',
        'session-xyz'
      );
    });

    it('should fall back to anonymous when X-Session-ID is absent', async () => {
      await request(app)
        .post('/api/files')
        .attach('file', Buffer.from('content'), 'test.txt');

      expect(fileService.saveUpload).toHaveBeenCalledWith(
        expect.anything(),
        'stored-test.txt',
        'anonymous'
      );
    });

    it('should return 500 when processUploadedFile throws', async () => {
      (fileService.processUploadedFile as jest.Mock).mockImplementation(() => {
        throw new Error('Processing error');
      });

      const response = await request(app)
        .post('/api/files')
        .attach('file', Buffer.from('content'), 'test.txt');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to upload file');
    });
  });

  describe('GET /api/files - List Files', () => {
    it('should return empty array when no files exist', async () => {
      const response = await request(app).get('/api/files');

      expect(response.status).toBe(200);
      expect(response.body.files).toEqual([]);
    });

    it('should return file list from DB', async () => {
      (fileService.getAllFiles as jest.Mock).mockResolvedValue([
        { fileName: 'report.pdf', storedName: '123-report.pdf', type: 'PDF', size: '2 KB', uploadDate: '2024-01-15' },
      ]);

      const response = await request(app).get('/api/files');

      expect(response.status).toBe(200);
      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0]).toMatchObject({ fileName: 'report.pdf', type: 'PDF' });
    });

    it('should return 500 when getAllFiles throws', async () => {
      (fileService.getAllFiles as jest.Mock).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/files');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to list files');
    });
  });

  describe('DELETE /api/files/:filename - Delete File', () => {
    it('should return 404 when file does not exist', async () => {
      const response = await request(app).delete('/api/files/non-existent.txt');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'File not found');
    });

    it('should delete file, remove Chroma chunks, and return success', async () => {
      (fileService.deleteFile as jest.Mock).mockResolvedValue({ success: true, originalName: 'report.pdf' });

      const response = await request(app).delete('/api/files/stored-report.pdf');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'File deleted successfully');
      expect(deleteDocumentByFilename).toHaveBeenCalledWith('report.pdf');
    });

    it('should still return success when Chroma deletion fails', async () => {
      (fileService.deleteFile as jest.Mock).mockResolvedValue({ success: true, originalName: 'report.pdf' });
      (deleteDocumentByFilename as jest.Mock).mockRejectedValue(new Error('Chroma error'));
      jest.spyOn(console, 'error').mockImplementation();

      const response = await request(app).delete('/api/files/stored-report.pdf');

      expect(response.status).toBe(200);
    });

    it('should return 500 when deleteFile throws', async () => {
      (fileService.deleteFile as jest.Mock).mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/files/some-file.txt');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to delete file');
    });
  });
});
