import express, { Request, Response } from 'express';
import multer from 'multer';
import fileService from '../services/file.service.js';
import { getSessionForUser } from '../services/chat-session-manager.js';
import { deleteDocumentByFilename } from '../agent/index.js';
import { logger } from '../lib/logger.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Upload file
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = fileService.processUploadedFile(req.file);
    const userId = req.user?.sub ?? 'anonymous';
    const chatService = getSessionForUser(userId);

    try {
      await chatService.indexDocument(req.file.buffer, req.file.originalname, req.file.mimetype, userId);
      fileService.saveUpload(req.file, fileInfo.storedName, userId);
      chatService.addFileUploadedMessage(req.file.originalname);
      logger.info('File uploaded and indexed', { filename: req.file.originalname, storedName: fileInfo.storedName, userId, requestId: req.requestId });
    } catch (indexError) {
      logger.error('Failed to index document', { filename: req.file.originalname, userId, requestId: req.requestId, error: (indexError as Error).message });
    }

    res.json({ message: 'File uploaded and indexed successfully', file: fileInfo });
  } catch (error) {
    logger.error('Upload error', { userId: req.user?.sub, requestId: req.requestId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// List all files
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub ?? 'anonymous';
    const files = await fileService.getAllFiles(userId);
    res.json({ files });
  } catch (error) {
    logger.error('List files error', { userId: req.user?.sub, requestId: req.requestId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Delete file
router.delete('/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const userId = req.user?.sub ?? 'anonymous';

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const result = await fileService.deleteFile(filename, userId);
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    if (result.originalName) {
      try {
        await deleteDocumentByFilename(result.originalName);
        logger.info('Chroma chunks deleted', { filename: result.originalName, userId, requestId: req.requestId });
      } catch (chromaErr) {
        logger.error('Failed to delete from Chroma', { filename: result.originalName, userId, requestId: req.requestId, error: (chromaErr as Error).message });
      }
      const chatService = getSessionForUser(userId);
      chatService.addFileDeletedMessage(result.originalName);
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    logger.error('Delete error', { filename: req.params.filename, userId: req.user?.sub, requestId: req.requestId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;
