export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = async (err: unknown, request: { url: string }, context: { routerKind: string }) => {
  // Import dynamically to avoid loading Sentry in non-error scenarios
  const Sentry = await import('@sentry/nextjs');

  Sentry.captureException(err, {
    contexts: {
      request: {
        url: request.url,
        router: context.routerKind,
      },
    },
  });
};
