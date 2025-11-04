export const safelyParseJson = <T = unknown>(value: string): T | string => {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('Failed to parse JSON payload', error);
    }
    return value;
  }
};
