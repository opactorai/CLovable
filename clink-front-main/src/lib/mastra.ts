// Mastra service placeholder - would be implemented with proper dependencies

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  threadId?: string;
  toolInvocations?: any[];
}

class MastraService {
  async chat(
    message: string,
    threadId: string,
    projectId: string,
  ): Promise<AsyncIterable<any>> {
    // Return a simple async iterator that yields a mock response
    return {
      async *[Symbol.asyncIterator]() {
        yield { type: 'text', content: 'Mastra service is not configured' };
      },
    };
  }

  async getMemory(threadId: string, resourceId: string) {
    return { uiMessages: [] };
  }

  async saveMessage(
    message: ChatMessage,
    threadId: string,
    resourceId: string,
  ) {
    // Placeholder: no-op until Mastra integration is implemented
    void message;
    void threadId;
    void resourceId;
  }
}

export const mastraService = new MastraService();
