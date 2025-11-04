export type AssistantKey = 'claude' | 'codex' | 'gemini' | 'glm';

export const ASSISTANT_OPTIONS: Record<
  AssistantKey,
  {
    label: string;
    models: { label: string; value: string; apiValue: string }[];
  }
> = {
  claude: {
    label: 'Claude',
    models: [
      {
        label: 'Sonnet 4.5',
        value: 'claude-sonnet-4.5',
        apiValue: 'claude-sonnet-4-5-20250929',
      },
      {
        label: 'Haiku 4.5',
        value: 'claude-haiku-4.5',
        apiValue: 'claude-haiku-4-5-20251001',
      },
      {
        label: 'Opus 4.1',
        value: 'claude-opus-4.1',
        apiValue: 'claude-opus-4-1-20250805',
      },
    ],
  },
  codex: {
    label: 'ChatGPT',
    models: [
      { label: 'GPT-5-Codex', value: 'gpt-5-codex', apiValue: 'gpt-5-codex' },
      { label: 'GPT-5', value: 'gpt-5', apiValue: 'gpt-5' },
    ],
  },
  gemini: {
    label: 'Gemini',
    models: [
      {
        label: 'Pro 2.5',
        value: 'gemini-2.5-pro',
        apiValue: 'gemini-2.5-pro',
      },
      {
        label: 'Flash 2.5',
        value: 'gemini-2.5-flash',
        apiValue: 'gemini-2.5-flash',
      },
    ],
  },
  glm: {
    label: 'GLM',
    models: [
      {
        label: 'GLM 4.6',
        value: 'glm-4.6',
        apiValue: 'glm-4.6',
      },
    ],
  },
};

export const normalizeCli = (cli?: string): AssistantKey => {
  if (cli === 'openai' || cli === 'codex') {
    return 'codex';
  }
  if (cli === 'anthropic' || cli === 'claude') {
    return 'claude';
  }
  if (cli === 'google' || cli === 'gemini') {
    return 'gemini';
  }
  if (cli === 'zai' || cli === 'glm') {
    return 'glm';
  }
  return 'codex';
};

export const resolveModelValue = (
  cli: AssistantKey,
  apiModel?: string | null,
): string => {
  if (!apiModel) {
    return ASSISTANT_OPTIONS[cli].models[0].value;
  }
  const matched = ASSISTANT_OPTIONS[cli].models.find(
    (option) => option.apiValue === apiModel || option.value === apiModel,
  );
  return matched ? matched.value : ASSISTANT_OPTIONS[cli].models[0].value;
};

export const resolveApiModel = (cli: AssistantKey, value: string): string => {
  const option = ASSISTANT_OPTIONS[cli].models.find(
    (model) => model.value === value,
  );
  return option ? option.apiValue : value;
};
