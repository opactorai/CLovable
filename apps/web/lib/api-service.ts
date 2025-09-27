// API Service for real integrations with external providers
import { NextRequest } from 'next/server';

export interface AIProvider {
  name: string;
  configured: boolean;
  available: boolean;
  error?: string;
  details: Record<string, any>;
}

export interface AIConnectivityStatus {
  overall: {
    configured: boolean;
    available: boolean;
  };
  providers: AIProvider[];
}

class APIService {
  private static instance: APIService;
  
  static getInstance(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService();
    }
    return APIService.instance;
  }

  // OpenAI Integration
  async testOpenAI(apiKey: string): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `OpenAI API Error: ${response.status} - ${errorData.error?.message || response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        details: {
          models_count: data.data?.length || 0,
          organization: data.data?.[0]?.owned_by || 'Unknown',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async sendOpenAIMessage(apiKey: string, message: string, model: string = 'gpt-3.5-turbo'): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: message,
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `OpenAI API Error: ${response.status} - ${errorData.error?.message || response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        response: data.choices?.[0]?.message?.content || 'No response received',
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Anthropic Integration
  async testAnthropic(apiKey: string): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [
            {
              role: 'user',
              content: 'Hello',
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `Anthropic API Error: ${response.status} - ${errorData.error?.message || response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        details: {
          model: data.model,
          usage: data.usage,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async sendAnthropicMessage(apiKey: string, message: string, model: string = 'claude-3-haiku-20240307'): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: message,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `Anthropic API Error: ${response.status} - ${errorData.error?.message || response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        response: data.content?.[0]?.text || 'No response received',
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // GitHub Integration
  async testGitHub(token: string): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const response = await fetch('https://api.github.com/user', {
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `GitHub API Error: ${response.status} - ${errorData.message || response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        details: {
          login: data.login,
          name: data.name,
          public_repos: data.public_repos,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Get AI connectivity status
  async getAIConnectivityStatus(): Promise<AIConnectivityStatus> {
    const providers: AIProvider[] = [];
    
    // Check OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      const openaiTest = await this.testOpenAI(openaiKey);
      providers.push({
        name: 'openai',
        configured: true,
        available: openaiTest.success,
        error: openaiTest.error,
        details: openaiTest.details || {},
      });
    } else {
      providers.push({
        name: 'openai',
        configured: false,
        available: false,
        error: 'API key not configured',
        details: {},
      });
    }

    // Check Anthropic
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      const anthropicTest = await this.testAnthropic(anthropicKey);
      providers.push({
        name: 'anthropic',
        configured: true,
        available: anthropicTest.success,
        error: anthropicTest.error,
        details: anthropicTest.details || {},
      });
    } else {
      providers.push({
        name: 'anthropic',
        configured: false,
        available: false,
        error: 'API key not configured',
        details: {},
      });
    }

    const overallConfigured = providers.some(p => p.configured);
    const overallAvailable = providers.some(p => p.available);

    return {
      overall: {
        configured: overallConfigured,
        available: overallAvailable,
      },
      providers,
    };
  }

  // Send message to AI provider
  async sendAIMessage(provider: string, message: string, apiKey?: string): Promise<{ success: boolean; response?: string; error?: string }> {
    const key = apiKey || process.env[`${provider.toUpperCase()}_API_KEY`];
    
    if (!key) {
      return {
        success: false,
        error: `${provider} API key not provided`,
      };
    }

    switch (provider.toLowerCase()) {
      case 'openai':
        return await this.sendOpenAIMessage(key, message);
      case 'anthropic':
        return await this.sendAnthropicMessage(key, message);
      default:
        return {
          success: false,
          error: `Unsupported provider: ${provider}`,
        };
    }
  }
}

export default APIService;