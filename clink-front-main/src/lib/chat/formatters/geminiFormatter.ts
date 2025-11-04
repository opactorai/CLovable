import { formatJson } from './commonFormatter';

export const flattenGeminiContent = (value: any): string => {
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
      .map((item) => {
        if (item?.type === 'content') {
          return flattenGeminiContent(item.content);
        }
        return flattenGeminiContent(item);
      })
      .filter((item) => item && item.trim().length > 0)
      .join('\n');
  }
  if (typeof value === 'object') {
    if (
      typeof value.text === 'string' &&
      (value.type === 'text' ||
        value.type === 'thinking' ||
        value.type === 'markdown')
    ) {
      return value.text;
    }
    if (typeof value.partial_json === 'string') {
      return value.partial_json;
    }
    if (value.content) {
      return flattenGeminiContent(value.content);
    }
  }
  return formatJson(value);
};

export const extractGeminiText = (raw: any): string => {
  if (!raw) {
    return '';
  }
  if (raw.update) {
    return flattenGeminiContent(
      raw.update.content ?? raw.update.text ?? raw.update,
    );
  }
  return flattenGeminiContent(raw.content ?? raw.text ?? raw);
};

export const formatGeminiToolUpdate = (update: any): string => {
  if (!update) {
    return '';
  }
  const lines: string[] = [];
  const contentText = flattenGeminiContent(update.content);
  if (contentText) {
    lines.push(contentText);
  }
  if (Array.isArray(update.locations) && update.locations.length > 0) {
    const formattedLocations = update.locations
      .map((location: any) => {
        if (typeof location === 'string') {
          return location;
        }
        if (typeof location?.path === 'string') {
          return location.path;
        }
        return formatJson(location);
      })
      .join(', ');
    lines.push(`locations: ${formattedLocations}`);
  }
  if (lines.length === 0) {
    return formatJson(update);
  }
  return lines.join('\n');
};

export const formatGeminiPlan = (entries?: any[]): string => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '';
  }
  return entries
    .map((entry, index) => {
      const rawContent = entry?.content ?? entry?.text ?? entry;
      const text = flattenGeminiContent(rawContent);
      const status = entry?.status ? `[${entry.status}] ` : '';
      const priority = entry?.priority ? ` (priority: ${entry.priority})` : '';
      return `${index + 1}. ${status}${text}${priority}`.trim();
    })
    .join('\n');
};
