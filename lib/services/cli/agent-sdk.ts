import { query as claudeAgentQuery } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

export type { SDKMessage };

type QueryArgs = Parameters<typeof claudeAgentQuery>[0];
type QueryReturn = ReturnType<typeof claudeAgentQuery>;
type QueryFunction = (args: QueryArgs) => QueryReturn;
type LiteHarnessOptions = QueryArgs['options'] & {
  agent?: string;
  harness?: string;
};

const LITE_HARNESS_PROVIDER = 'lite-harness';
const LITE_HARNESS_DEFAULT_HARNESS = 'claude-code';

function getProvider() {
  return (process.env.CLAUDABLE_AGENT_SDK_PROVIDER || 'claude-agent-sdk')
    .trim()
    .toLowerCase();
}

function withLiteHarnessOptions(args: QueryArgs): QueryArgs {
  const options = (args.options || {}) as LiteHarnessOptions;

  return {
    ...args,
    options: {
      ...options,
      harness:
        process.env.LITE_HARNESS_HARNESS ||
        process.env.LITE_HARNESS_AGENT ||
        options.harness ||
        options.agent ||
        LITE_HARNESS_DEFAULT_HARNESS,
      ...(process.env.LITE_HARNESS_MODEL
        ? { model: process.env.LITE_HARNESS_MODEL }
        : {}),
    } as QueryArgs['options'],
  };
}

async function loadQuery(): Promise<QueryFunction> {
  if (getProvider() !== LITE_HARNESS_PROVIDER) {
    return claudeAgentQuery;
  }

  const liteHarnessPackage = process.env.LITE_HARNESS_PACKAGE || '@lite-harness/sdk';
  const liteHarness = (await import(liteHarnessPackage)) as {
    query: QueryFunction;
  };

  return (args) => liteHarness.query(withLiteHarnessOptions(args));
}

export const query = await loadQuery();
