import { useState, useEffect, useRef } from 'react';
import { Button, MessageStrip } from '@ui5/webcomponents-react';
import { FileInfo, fileApi } from '../api';
import { Header } from './Header';
import { FileList } from './FileList';

interface FilesViewProps {
  isDarkMode: boolean;
}

type NotificationType = 'success' | 'error' | null;

export function FilesView({ isDarkMode }: FilesViewProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [notification, setNotification] = useState<{ type: NotificationType; message: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ storedName: string; fileName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setIsLoadingFiles(true);
      const response = await fileApi.getAllFiles();
      setFiles(response.files);
    } catch (error) {
      console.error('Error loading files:', error);
      setNotification({ type: 'error', message: 'Failed to load files. Please try again.' });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await fileApi.uploadFile(file);
      setNotification({ type: 'success', message: `File "${file.name}" uploaded successfully!` });
      loadFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
      setNotification({ type: 'error', message: 'Failed to upload file. Please try again.' });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileDeleteRequest = (storedName: string, fileName: string) => {
    setDeleteConfirm({ storedName, fileName });
  };

  const handleFileDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    const { storedName, fileName } = deleteConfirm;
    setDeleteConfirm(null);

    try {
      await fileApi.deleteFile(storedName);
      setNotification({ type: 'success', message: `File "${fileName}" deleted successfully!` });
      loadFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      setNotification({ type: 'error', message: 'Failed to delete file. Please try again.' });
    }
  };

  const handleFileDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
      <Header
        title="Files"
        buttonText="Upload File"
        buttonIcon="add"
        onButtonClick={() => fileInputRef.current?.click()}
        isDarkMode={isDarkMode}
      />

      {notification && (
        <MessageStrip
          design={notification.type === 'success' ? 'Positive' : 'Negative'}
          hideCloseButton={false}
          onClose={() => setNotification(null)}
          style={{ margin: '0.5rem 2rem', width: 'calc(100% - 4rem)' }}
        >
          {notification.message}
        </MessageStrip>
      )}

      {deleteConfirm && (
        <MessageStrip
          design="Critical"
          hideCloseButton={true}
          style={{
            margin: '0.5rem 2rem',
            width: 'calc(100% - 4rem)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>Are you sure you want to delete "{deleteConfirm.fileName}"?</span>
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
            <Button design="Negative" onClick={handleFileDeleteConfirm}>
              Delete
            </Button>
            <Button design="Transparent" onClick={handleFileDeleteCancel}>
              Cancel
            </Button>
          </div>
        </MessageStrip>
      )}

      <FileList
        files={files}
        isLoading={isLoadingFiles}
        onDeleteFile={handleFileDeleteRequest}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
