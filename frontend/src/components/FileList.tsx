import { Label, Button, AnalyticalTable } from '@ui5/webcomponents-react';
import { FileInfo } from '../api';

interface FileListProps {
  files: FileInfo[];
  isLoading: boolean;
  onDeleteFile: (storedName: string, fileName: string) => void;
  isDarkMode: boolean;
}

export function FileList({ files, isLoading, onDeleteFile, isDarkMode }: FileListProps) {
  const columns = [
    {
      Header: 'File Name',
      accessor: 'fileName',
      hAlign: 'Begin' as const,
    },
    {
      Header: 'Type',
      accessor: 'type',
      hAlign: 'Center' as const,
    },
    {
      Header: 'Size',
      accessor: 'size',
      hAlign: 'Center' as const,
    },
    {
      Header: 'Upload Date',
      accessor: 'uploadDate',
      hAlign: 'Center' as const,
    },
    {
      Header: 'Actions',
      accessor: 'actions',
      disableSortBy: true,
      hAlign: 'Center' as const,
      Cell: (row: any) => (
        <Button
          icon="delete"
          design="Negative"
          onClick={() => {
            onDeleteFile(row.row.original.storedName, row.row.original.fileName);
          }}
        />
      ),
    },
  ];

  return (
    <div style={{ flex: 1, padding: '1rem 2rem', overflow: 'auto', backgroundColor: isDarkMode ? '#12171c' : '#f5f5f5' }}>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Label>Loading files...</Label>
        </div>
      ) : files.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Label>No files uploaded yet. Click "Upload File" to get started.</Label>
        </div>
      ) : (
        <AnalyticalTable
          columns={columns}
          data={files}
          visibleRows={files.length}
          minRows={0}
        />
      )}
    </div>
  );
}
