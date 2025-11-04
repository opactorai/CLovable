import FS from '@isomorphic-git/lightning-fs';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

// Initialize Lightning FS
const fs = new FS('freerider-fs');

export interface GitRepository {
  name: string;
  url: string;
  branch: string;
  files: FileNode[];
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
}

class GitService {
  private fs: FS;
  private workdir = '/project';

  constructor() {
    this.fs = fs;
  }

  async initRepository(repoUrl: string, token?: string): Promise<void> {
    try {
      // Clone repository
      await git.clone({
        fs: this.fs,
        http,
        dir: this.workdir,
        url: repoUrl,
        ref: 'main',
        singleBranch: true,
        depth: 1,
        ...(token && {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      });
    } catch (error) {
      console.error('Failed to clone repository:', error);
      throw error;
    }
  }

  async readFile(filepath: string): Promise<string> {
    try {
      const data = await this.fs.promises.readFile(
        `${this.workdir}/${filepath}`,
        'utf8',
      );
      return data;
    } catch (error) {
      console.error('Failed to read file:', error);
      throw error;
    }
  }

  async writeFile(filepath: string, content: string): Promise<void> {
    try {
      await this.fs.promises.writeFile(
        `${this.workdir}/${filepath}`,
        content,
        'utf8',
      );
    } catch (error) {
      console.error('Failed to write file:', error);
      throw error;
    }
  }

  async getFileTree(): Promise<FileNode[]> {
    try {
      return await this.buildFileTree(this.workdir);
    } catch (error) {
      console.error('Failed to get file tree:', error);
      return [];
    }
  }

  private async buildFileTree(
    dirPath: string,
    basePath: string = '',
  ): Promise<FileNode[]> {
    const files: FileNode[] = [];

    try {
      const entries = await this.fs.promises.readdir(dirPath);

      for (const entry of entries) {
        if (entry.startsWith('.git')) continue; // Skip git files

        const fullPath = `${dirPath}/${entry}`;
        const relativePath = basePath ? `${basePath}/${entry}` : entry;

        try {
          const stat = await this.fs.promises.stat(fullPath);

          if (stat.isDirectory()) {
            const children = await this.buildFileTree(fullPath, relativePath);
            files.push({
              name: entry,
              path: relativePath,
              type: 'folder',
              children,
            });
          } else {
            files.push({
              name: entry,
              path: relativePath,
              type: 'file',
            });
          }
        } catch (statError) {
          console.warn(`Failed to stat ${fullPath}:`, statError);
        }
      }
    } catch (error) {
      console.error(`Failed to read directory ${dirPath}:`, error);
    }

    return files;
  }

  async commitChanges(message: string): Promise<void> {
    try {
      // Add all files
      await git.add({
        fs: this.fs,
        dir: this.workdir,
        filepath: '.',
      });

      // Commit changes
      await git.commit({
        fs: this.fs,
        dir: this.workdir,
        message,
        author: {
          name: 'Clink AI',
          email: 'ai@clinks.app',
        },
      });
    } catch (error) {
      console.error('Failed to commit changes:', error);
      throw error;
    }
  }

  async pushChanges(token?: string): Promise<void> {
    try {
      await git.push({
        fs: this.fs,
        http,
        dir: this.workdir,
        remote: 'origin',
        ref: 'main',
        ...(token && {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      });
    } catch (error) {
      console.error('Failed to push changes:', error);
      throw error;
    }
  }

  async createFile(filepath: string, content: string = ''): Promise<void> {
    await this.writeFile(filepath, content);
  }

  async deleteFile(filepath: string): Promise<void> {
    try {
      await this.fs.promises.unlink(`${this.workdir}/${filepath}`);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  async createFolder(folderPath: string): Promise<void> {
    try {
      await this.fs.promises.mkdir(`${this.workdir}/${folderPath}`, {
        recursive: true,
      } as any);
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  }
}

export const gitService = new GitService();
