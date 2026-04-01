import express, { Request, Response } from 'express';
import multer from 'multer';
import fileService from '../services/file.service.js';
import chatService from '../services/chat.service.js';
import { deleteDocumentByFilename } from '../agent/index.js';

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

    try {
      await chatService.indexDocument(req.file.buffer, req.file.originalname, req.file.mimetype, userId);
      fileService.saveUpload(req.file, fileInfo.storedName, userId);
      chatService.addFileUploadedMessage(req.file.originalname);
      console.log(`✅ File uploaded and indexed: ${req.file.originalname}`);
    } catch (indexError) {
      console.error('Failed to index document:', indexError);
    }

    res.json({ message: 'File uploaded and indexed successfully', file: fileInfo });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// List all files
router.get('/', async (_req: Request, res: Response) => {
  try {
    const files = await fileService.getAllFiles();
    res.json({ files });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Delete file
router.delete('/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const result = await fileService.deleteFile(filename);
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    if (result.originalName) {
      try {
        await deleteDocumentByFilename(result.originalName);
        console.log(`✅ Chroma chunks deleted for: ${result.originalName}`);
      } catch (chromaErr) {
        console.error('Failed to delete from Chroma:', chromaErr);
      }
      chatService.addFileDeletedMessage(result.originalName);
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;
