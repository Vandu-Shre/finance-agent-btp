export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  timestamp: string;
}

export interface FileInfo {
  fileName: string;
  storedName: string;
  type: string;
  size: string;
  uploadDate: string;
}

export const chatApi = {
  createWebSocket: jest.fn(),
  sendMessage: jest.fn(),
  startNewSession: jest.fn(),
};

export const fileApi = {
  getAllFiles: jest.fn().mockResolvedValue({ files: [] }),
  uploadFile: jest.fn().mockResolvedValue({}),
  deleteFile: jest.fn().mockResolvedValue({}),
};
