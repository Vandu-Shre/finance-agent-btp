import { randomUUID } from 'crypto';
import { prisma } from './db.service.js';

export interface FileInfo {
  fileName: string;
  storedName: string;
  type: string;
  size: string;
  uploadDate: string;
}

export class FileService {
  /**
   * Extract file metadata and generate a unique stored name.
   * Does not store anything — call saveUpload() to persist to DB.
   */
  processUploadedFile(file: Express.Multer.File): FileInfo {
    const storedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;
    const parts = file.originalname.split('.');
    const ext = parts.length > 1 ? parts.pop()?.toUpperCase() || 'Unknown' : 'Unknown';
    return {
      fileName: file.originalname,
      storedName,
      type: ext,
      size: this.formatFileSize(file.size),
      uploadDate: new Date().toISOString().split('T')[0] || '',
    };
  }

  /**
   * Persist file metadata to the database (fire-and-forget).
   */
  saveUpload(file: Express.Multer.File, storedName: string, sessionId: string): void {
    prisma.file.create({
      data: {
        id: randomUUID(),
        sessionId,
        fileName: file.originalname,
        storedName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    }).catch((err: Error) => console.error('DB persist file failed:', err.message));
  }

  /**
   * Return all file records from the database.
   */
  async getAllFiles(): Promise<FileInfo[]> {
    const rows = await prisma.file.findMany({ orderBy: { uploadDate: 'desc' } });
    return rows.map((r: typeof rows[number]) => {
      const parts = r.fileName.split('.');
      const ext = parts.length > 1 ? parts.pop()?.toUpperCase() || 'Unknown' : 'Unknown';
      return {
        fileName: r.fileName,
        storedName: r.storedName,
        type: ext,
        size: this.formatFileSize(r.sizeBytes ?? 0),
        uploadDate: r.uploadDate.toISOString().split('T')[0] || '',
      };
    });
  }

  /**
   * Delete a file record from the database by its stored name.
   */
  async deleteFile(storedName: string): Promise<{ success: boolean; error?: string; originalName?: string }> {
    const file = await prisma.file.findFirst({ where: { storedName } });
    if (!file) return { success: false, error: 'File not found' };
    await prisma.file.delete({ where: { storedName } });
    return { success: true, originalName: file.fileName };
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

export default new FileService();
