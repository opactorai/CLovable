const enableDebug =
  process.env.NEXT_PUBLIC_ENABLE_CLIENT_DEBUG === 'true' ||
  process.env.NODE_ENV !== 'production';

const noop = () => undefined;

export const clientLogger = {
  debug: enableDebug ? console.debug.bind(console) : noop,
  info: enableDebug ? console.info.bind(console) : noop,
  warn: enableDebug ? console.warn.bind(console) : noop,
  error: enableDebug ? console.error.bind(console) : noop,
};
