import request from 'supertest';
import express from 'express';
import fileRoutes from '../../routes/file.routes';
import chatService from '../../services/chat.service';

// Mock the chat service
jest.mock('../../services/chat.service', () => ({
  __esModule: true,
  default: {
    indexDocument: jest.fn().mockResolvedValue(undefined),
    isVectorStoreReady: jest.fn().mockReturnValue(true),
    addFileUploadedMessage: jest.fn(),
    addFileDeletedMessage: jest.fn(),
  },
}));

jest.mock('../../agent/index.js', () => ({
  deleteDocumentByFilename: jest.fn().mockResolvedValue(undefined),
}));

// Stateful in-memory mock matching the new FileService DB-backed interface
const mockFileStore = new Map<string, any>();
jest.mock('../../services/file.service.js', () => ({
  __esModule: true,
  default: {
    processUploadedFile: jest.fn().mockImplementation((file: any) => {
      const storedName = `stored-${file.originalname}`;
      const parts = file.originalname.split('.');
      const type = parts.length > 1 ? parts.pop()?.toUpperCase() || 'Unknown' : 'Unknown';
      const bytes = file.size || file.buffer?.length || 0;
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = bytes === 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(k));
      const size = bytes === 0 ? '0 Bytes' : `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
      return { fileName: file.originalname, storedName, type, size, uploadDate: '2024-01-01' };
    }),
    saveUpload: jest.fn().mockImplementation((file: any, storedName: string) => {
      const parts = file.originalname.split('.');
      const type = parts.length > 1 ? parts.pop()?.toUpperCase() || 'Unknown' : 'Unknown';
      mockFileStore.set(storedName, { fileName: file.originalname, storedName, type, size: '1 KB', uploadDate: '2024-01-01' });
    }),
    getAllFiles: jest.fn().mockImplementation(() => Promise.resolve(Array.from(mockFileStore.values()))),
    deleteFile: jest.fn().mockImplementation((storedName: string) => {
      if (!mockFileStore.has(storedName)) return Promise.resolve({ success: false, error: 'File not found' });
      const entry = mockFileStore.get(storedName);
      mockFileStore.delete(storedName);
      return Promise.resolve({ success: true, originalName: entry.fileName });
    }),
  },
}));

// Create a test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/files', fileRoutes);
  return app;
}

describe('File Routes - Vector Store Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileStore.clear();
    app = createTestApp();
  });

  describe('POST /api/files - File Upload with Indexing', () => {
    it('should upload and index a text file successfully', async () => {
      const response = await request(app)
        .post('/api/files')
        .attach('file', Buffer.from('Test file content'), 'test.txt')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'File uploaded and indexed successfully',
        file: expect.objectContaining({
          fileName: 'test.txt',
          storedName: expect.any(String),
          type: 'TXT',
          size: expect.any(String),
          uploadDate: expect.any(String),
        }),
      });

      expect(chatService.indexDocument).toHaveBeenCalledWith(
        expect.any(Buffer),
        'test.txt',
        'text/plain',
        'anonymous'
      );
    });

    it('should upload and index a CSV file successfully', async () => {
      const csvContent = 'name,age\nJohn,30\nJane,25';

      const response = await request(app)
        .post('/api/files')
        .attach('file', Buffer.from(csvContent), 'data.csv')
        .expect(200);

      expect(response.body.file.fileName).toBe('data.csv');
      expect(response.body.file.type).toBe('CSV');

      expect(chatService.indexDocument).toHaveBeenCalledWith(
        expect.any(Buffer),
        'data.csv',
        'text/csv',
        'anonymous'
      );
    });

    it('should upload and index a JSON file successfully', async () => {
      const jsonContent = JSON.stringify({ key: 'value' });

      const response = await request(app)
        .post('/api/files')
        .attach('file', Buffer.from(jsonContent), 'data.json')
        .expect(200);

      expect(response.body.file.fileName).toBe('data.json');
      expect(response.body.file.type).toBe('JSON');

      expect(chatService.indexDocument).toHaveBeenCalledWith(
        expect.any(Buffer),
        'data.json',
        'application/json',
        'anonymous'
      );
    });

    it('should still upload file even if indexing fails', async () => {
      (chatService.indexDocument as jest.Mock).mockRejectedValueOnce(
        new Error('Indexing failed')
      );

      const response = await request(app)
        .post('/api/files')
        .attach('file', Buffer.from('Test content'), 'test.txt')
        .expect(200);

      expect(response.body.message).toBe('File uploaded and indexed successfully');
      expect(response.body.file).toBeDefined();

      // Should have attempted indexing
      expect(chatService.indexDocument).toHaveBeenCalled();
    });

    it('should return 400 if no file is provided', async () => {
      const response = await request(app).post('/api/files').expect(400);

      expect(response.body).toEqual({
        error: 'No file uploaded',
      });

      expect(chatService.indexDocument).not.toHaveBeenCalled();
    });

    it('should handle large files within limit', async () => {
      const largeContent = Buffer.alloc(5 * 1024 * 1024, 'a'); // 5MB

      const response = await request(app)
        .post('/api/files')
        .attach('file', largeContent, 'large.txt')
        .expect(200);

      expect(response.body.file.size).toContain('MB');
      expect(chatService.indexDocument).toHaveBeenCalled();
    });

    it('should reject files exceeding size limit', async () => {
      const tooLarge = Buffer.alloc(11 * 1024 * 1024, 'a'); // 11MB (over 10MB limit)

      await request(app)
        .post('/api/files')
        .attach('file', tooLarge, 'too-large.txt')
        .expect(500);

      expect(chatService.indexDocument).not.toHaveBeenCalled();
    });

    it('should handle files with special characters in filename', async () => {
      const response = await request(app)
        .post('/api/files')
        .attach('file', Buffer.from('Content'), 'file (1) [test].txt')
        .expect(200);

      expect(response.body.file.fileName).toBe('file (1) [test].txt');
      expect(chatService.indexDocument).toHaveBeenCalledWith(
        expect.any(Buffer),
        'file (1) [test].txt',
        'text/plain',
        'anonymous'
      );
    });

    it('should handle files with no extension', async () => {
      const response = await request(app)
        .post('/api/files')
        .attach('file', Buffer.from('Content'), 'README')
        .expect(200);

      expect(response.body.file.fileName).toBe('README');
      expect(response.body.file.type).toBe('Unknown');
    });

    it('should pass correct mimetype to indexing service', async () => {
      await request(app)
        .post('/api/files')
        .attach('file', Buffer.from('Test'), 'test.txt')
        .expect(200);

      const indexCall = (chatService.indexDocument as jest.Mock).mock.calls[0];
      expect(indexCall[2]).toBe('text/plain'); // mimetype
    });

    it('should use X-Session-ID header as userId when provided', async () => {
      await request(app)
        .post('/api/files')
        .set('x-session-id', 'session-abc-123')
        .attach('file', Buffer.from('Content'), 'test.txt')
        .expect(200);

      expect(chatService.indexDocument).toHaveBeenCalledWith(
        expect.any(Buffer),
        'test.txt',
        'text/plain',
        'session-abc-123'
      );
    });

    it('should fall back to "anonymous" when X-Session-ID header is absent', async () => {
      await request(app)
        .post('/api/files')
        .attach('file', Buffer.from('Content'), 'test.txt')
        .expect(200);

      expect(chatService.indexDocument).toHaveBeenCalledWith(
        expect.any(Buffer),
        'test.txt',
        'text/plain',
        'anonymous'
      );
    });
  });

  describe('GET /api/files - List Files', () => {
    it('should list uploaded files', async () => {
      // Upload a file first
      await request(app)
        .post('/api/files')
        .attach('file', Buffer.from('Test'), 'test.txt')
        .expect(200);

      const response = await request(app).get('/api/files').expect(200);

      expect(response.body.files).toBeInstanceOf(Array);
      expect(response.body.files.length).toBeGreaterThan(0);
      expect(response.body.files[0]).toMatchObject({
        fileName: expect.any(String),
        storedName: expect.any(String),
        type: expect.any(String),
        size: expect.any(String),
        uploadDate: expect.any(String),
      });
    });
  });

  describe('DELETE /api/files/:filename - Delete File', () => {
    it('should delete uploaded file', async () => {
      // Upload a file first
      const uploadResponse = await request(app)
        .post('/api/files')
        .attach('file', Buffer.from('Test'), 'test.txt')
        .expect(200);

      const storedName = uploadResponse.body.file.storedName;

      // Delete the file
      await request(app).delete(`/api/files/${storedName}`).expect(200);

      // Verify it's deleted
      const listResponse = await request(app).get('/api/files').expect(200);
      const fileExists = listResponse.body.files.some(
        (f: any) => f.storedName === storedName
      );
      expect(fileExists).toBe(false);
    });

    it('should return 404 for non-existent file', async () => {
      await request(app).delete('/api/files/nonexistent.txt').expect(404);
    });
  });

  describe('Error Handling', () => {
    it('should log indexing errors without failing upload', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      (chatService.indexDocument as jest.Mock).mockRejectedValueOnce(
        new Error('Indexing error')
      );

      await request(app)
        .post('/api/files')
        .attach('file', Buffer.from('Test'), 'test.txt')
        .expect(200);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to index document:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
