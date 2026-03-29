import type {
  FileInfo,
  UploadFileResponse,
  GetFilesResponse,
  DeleteFileResponse,
  FinanceAgentConfig,
} from './types.js';

/**
 * File API Client
 * Handles file upload, listing, and deletion operations
 */
export class FileClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: FinanceAgentConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.headers = {
      ...config.headers,
    };

    if (config.authToken) {
      this.headers['Authorization'] = `Bearer ${config.authToken}`;
    }
  }

  /**
   * Upload a file to the server
   * @param file - File to upload (File object or Buffer with filename)
   * @returns Upload response with file information
   */
  async uploadFile(
    file: File | { buffer: Buffer; filename: string }
  ): Promise<UploadFileResponse> {
    const formData = new FormData();

    if ('buffer' in file) {
      // Node.js environment - convert Buffer to Blob
      const blob = new Blob([new Uint8Array(file.buffer)]);
      formData.append('file', blob, file.filename);
    } else {
      // Browser environment
      formData.append('file', file);
    }

    const response = await fetch(`${this.baseUrl}/api/files`, {
      method: 'POST',
      headers: this.headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to upload file' }));
      throw new Error(error.error || `Upload failed with status ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get list of all uploaded files
   * @returns List of files
   */
  async getFiles(): Promise<FileInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/files`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get files' }));
      throw new Error(error.error || `Get files failed with status ${response.status}`);
    }

    const data: GetFilesResponse = await response.json();
    return data.files;
  }

  /**
   * Delete a file by its stored name
   * @param filename - Stored name of the file to delete
   * @returns Delete confirmation message
   */
  async deleteFile(filename: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/files/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete file' }));
      throw new Error(error.error || `Delete failed with status ${response.status}`);
    }

    const data: DeleteFileResponse = await response.json();
    return data.message;
  }
}
