import AIChat from '@/components/AIChat';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            AI Chat
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Chat with AI providers using your configured API keys
          </p>
        </div>
        <AIChat />
      </div>
    </div>
  );
}