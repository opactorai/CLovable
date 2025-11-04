import { FileIcon as VSCodeFileIcon } from 'react-material-vscode-icons';

interface FileIconProps {
  fileName: string;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({ fileName, className = '' }) => {
  return (
    <VSCodeFileIcon
      fileName={fileName}
      isFolder={false}
      className={className}
      size={16}
    />
  );
};

interface FolderIconProps {
  folderName: string;
  isOpen: boolean;
  className?: string;
}

export const FolderIcon: React.FC<FolderIconProps> = ({ folderName, isOpen, className = '' }) => {
  return (
    <VSCodeFileIcon
      fileName={folderName}
      isFolder={true}
      isExpanded={isOpen}
      className={className}
      size={16}
    />
  );
};
