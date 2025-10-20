export interface ProjectFileEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  hasChildren?: boolean;
}
