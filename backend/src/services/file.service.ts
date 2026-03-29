import { randomUUID } from 'crypto';
import { query, persist } from './db.service.js';

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
    persist(
      `INSERT INTO files (id, session_id, file_name, stored_name, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (stored_name) DO NOTHING`,
      [randomUUID(), sessionId, file.originalname, storedName, file.mimetype, file.size]
    );
  }

  /**
   * Return all file records from the database.
   */
  async getAllFiles(): Promise<FileInfo[]> {
    const rows = await query<{
      file_name: string;
      stored_name: string;
      size_bytes: number;
      upload_date: Date;
    }>('SELECT file_name, stored_name, size_bytes, upload_date FROM files ORDER BY upload_date DESC');

    return rows.map(r => {
      const parts = r.file_name.split('.');
      const ext = parts.length > 1 ? parts.pop()?.toUpperCase() || 'Unknown' : 'Unknown';
      return {
        fileName: r.file_name,
        storedName: r.stored_name,
        type: ext,
        size: this.formatFileSize(r.size_bytes),
        uploadDate: new Date(r.upload_date).toISOString().split('T')[0] || '',
      };
    });
  }

  /**
   * Delete a file record from the database by its stored name.
   */
  async deleteFile(storedName: string): Promise<{ success: boolean; error?: string; originalName?: string }> {
    const rows = await query<{ file_name: string }>(
      'SELECT file_name FROM files WHERE stored_name = $1',
      [storedName]
    );
    if (rows.length === 0) return { success: false, error: 'File not found' };
    await query('DELETE FROM files WHERE stored_name = $1', [storedName]);
    return { success: true, originalName: rows[0]!.file_name };
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
