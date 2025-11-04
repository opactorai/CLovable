export const formatJson = (value: any): string => {
  try {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const decodeBase64 = (input?: string | null): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  try {
    const binaryString = atob(input);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(bytes);
  } catch (error) {
    console.error('Failed to decode base64:', error);
    return input;
  }
};

export const formatCommand = (command: any): string => {
  if (typeof command === 'string') {
    return command;
  }
  if (command && typeof command === 'object') {
    if (typeof command.command === 'string') {
      return command.command;
    }
    if (typeof command.description === 'string') {
      return command.description;
    }
  }
  return formatJson(command);
};

export const formatStreamChunk = (stream: string, chunk: string): string => {
  if (!chunk) {
    return '';
  }

  // stream is just metadata (stdout/stderr), return the actual chunk content
  return chunk;
};
