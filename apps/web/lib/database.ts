// Database utility for Vercel deployment
// Using Vercel KV (Redis) for data persistence
import { kv } from '@vercel/kv';

export interface APIKey {
  id: string;
  provider: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used: string | null;
  usage_count: number;
  encrypted_key?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  updated_at: string;
  api_keys: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  last_login: string | null;
}

class DatabaseService {
  private static instance: DatabaseService;
  
  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // API Keys operations
  async getAPIKeys(): Promise<APIKey[]> {
    try {
      const keys = await kv.get<APIKey[]>('api_keys') || [];
      return keys;
    } catch (error) {
      console.error('Error fetching API keys:', error);
      return [];
    }
  }

  async saveAPIKey(key: Omit<APIKey, 'id' | 'created_at' | 'last_used' | 'usage_count'>): Promise<string> {
    try {
      const keys = await this.getAPIKeys();
      const newKey: APIKey = {
        ...key,
        id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        last_used: null,
        usage_count: 0,
      };
      
      keys.push(newKey);
      await kv.set('api_keys', keys);
      return newKey.id;
    } catch (error) {
      console.error('Error saving API key:', error);
      throw new Error('Failed to save API key');
    }
  }

  async updateAPIKey(id: string, updates: Partial<APIKey>): Promise<boolean> {
    try {
      const keys = await this.getAPIKeys();
      const index = keys.findIndex(key => key.id === id);
      
      if (index === -1) return false;
      
      keys[index] = { ...keys[index], ...updates };
      await kv.set('api_keys', keys);
      return true;
    } catch (error) {
      console.error('Error updating API key:', error);
      return false;
    }
  }

  async deleteAPIKey(id: string): Promise<boolean> {
    try {
      const keys = await this.getAPIKeys();
      const filteredKeys = keys.filter(key => key.id !== id);
      
      if (filteredKeys.length === keys.length) return false;
      
      await kv.set('api_keys', filteredKeys);
      return true;
    } catch (error) {
      console.error('Error deleting API key:', error);
      return false;
    }
  }

  async incrementUsageCount(id: string): Promise<void> {
    try {
      const keys = await this.getAPIKeys();
      const index = keys.findIndex(key => key.id === id);
      
      if (index !== -1) {
        keys[index].usage_count += 1;
        keys[index].last_used = new Date().toISOString();
        await kv.set('api_keys', keys);
      }
    } catch (error) {
      console.error('Error incrementing usage count:', error);
    }
  }

  // Projects operations
  async getProjects(): Promise<Project[]> {
    try {
      const projects = await kv.get<Project[]>('projects') || [];
      return projects;
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  }

  async saveProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const projects = await this.getProjects();
      const newProject: Project = {
        ...project,
        id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      projects.push(newProject);
      await kv.set('projects', projects);
      return newProject.id;
    } catch (error) {
      console.error('Error saving project:', error);
      throw new Error('Failed to save project');
    }
  }

  // Users operations
  async getUsers(): Promise<User[]> {
    try {
      const users = await kv.get<User[]>('users') || [];
      return users;
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  async saveUser(user: Omit<User, 'id' | 'created_at' | 'last_login'>): Promise<string> {
    try {
      const users = await this.getUsers();
      const newUser: User = {
        ...user,
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        last_login: null,
      };
      
      users.push(newUser);
      await kv.set('users', users);
      return newUser.id;
    } catch (error) {
      console.error('Error saving user:', error);
      throw new Error('Failed to save user');
    }
  }
}

export default DatabaseService;