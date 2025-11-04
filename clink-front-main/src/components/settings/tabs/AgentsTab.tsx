const agents = [
  { name: 'Claude', status: 'connected', model: 'claude-3-opus' },
  { name: 'GPT-4', status: 'available', model: 'gpt-4-turbo' },
  { name: 'Gemini', status: 'available', model: 'gemini-pro' },
];

export default function AgentsTab() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          AI Agents
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Manage your connected AI agents and their configurations.
        </p>
      </div>

      <div className="space-y-4">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                {agent.name}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {agent.model}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-sm ${
                  agent.status === 'connected'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {agent.status === 'connected' ? '● Connected' : '○ Available'}
              </span>
              <button className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
