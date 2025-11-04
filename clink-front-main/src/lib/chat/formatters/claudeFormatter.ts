export const extractClaudeText = (raw: any): string => {
  const content = raw?.message?.content;
  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item?.type === 'text')
      .map((item: any) => item?.text ?? '')
      .join('');
  }
  if (typeof content === 'string') {
    return content;
  }
  return '';
};

export const flattenClaudeContent = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => flattenClaudeContent(item))
      .filter((item) => item && item.trim().length > 0)
      .join('\n');
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string' && value.type === 'text') {
      return value.text;
    }
    if (
      typeof value.thinking === 'string' &&
      (value.type === 'thinking' || value.type === 'thinking_delta')
    ) {
      return value.thinking;
    }
    if (typeof value.partial_json === 'string') {
      return value.partial_json;
    }
    if (value.content) {
      return flattenClaudeContent(value.content);
    }
    if (value.delta) {
      return flattenClaudeContent(value.delta);
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};
