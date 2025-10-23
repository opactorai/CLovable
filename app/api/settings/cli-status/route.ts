/**
 * CLI Status API Route
 * GET /api/settings/cli-status - Check CLI installation status
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { CLIStatus } from '@/types/backend';
import { CODEX_MODEL_DEFINITIONS } from '@/lib/constants/codexModels';
import { QWEN_MODEL_DEFINITIONS } from '@/lib/constants/qwenModels';
import { GLM_MODEL_DEFINITIONS } from '@/lib/constants/glmModels';
import { CURSOR_MODEL_DEFINITIONS } from '@/lib/constants/cursorModels';

const execAsync = promisify(exec);

/**
 * Check Claude Code CLI installation
 */
async function checkClaudeCodeCLI(): Promise<{
  installed: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const { stdout } = await execAsync('claude --version');
    const version = stdout.trim();
    return {
      installed: true,
      version,
    };
  } catch (error) {
    return {
      installed: false,
      error: error instanceof Error ? error.message : 'Failed to check CLI',
    };
  }
}

async function checkCodexCLI(): Promise<{
  installed: boolean;
  version?: string;
  error?: string;
}> {
  const executable = process.platform === 'win32' ? 'codex.cmd' : 'codex';
  try {
    const { stdout } = await execAsync(`${executable} --version`);
    const version = stdout.trim();
    return {
      installed: true,
      version: version || 'installed',
    };
  } catch (error) {
    return {
      installed: false,
      error: error instanceof Error ? error.message : 'Failed to check Codex CLI',
    };
  }
}

async function checkCursorCLI(): Promise<{
  installed: boolean;
  version?: string;
  error?: string;
}> {
  const executable = process.platform === 'win32' ? 'cursor-agent.cmd' : 'cursor-agent';
  try {
    const { stdout, stderr } = await execAsync(`${executable} --version`);
    const output = `${stdout.trim()} ${stderr.trim()}`.trim();
    const version = output.length > 0 ? output : 'installed';
    return {
      installed: true,
      version,
    };
  } catch (error) {
    return {
      installed: false,
      error: error instanceof Error ? error.message : 'Failed to check Cursor CLI',
    };
  }
}

async function checkQwenCLI(): Promise<{
  installed: boolean;
  version?: string;
  error?: string;
}> {
  const executable = process.platform === 'win32' ? 'qwen.cmd' : 'qwen';
  try {
    const { stdout } = await execAsync(`${executable} --version`);
    const version = stdout.trim();
    return {
      installed: true,
      version: version || 'installed',
    };
  } catch (error) {
    return {
      installed: false,
      error: error instanceof Error ? error.message : 'Failed to check Qwen CLI',
    };
  }
}

/**
 * GET /api/settings/cli-status
 * Check CLI installation status
 */
export async function GET() {
  try {
    const status: CLIStatus = {
      claude: {
        installed: false,
        checking: false,
      },
      cursor: {
        installed: false,
        checking: false,
      },
      codex: {
        installed: false,
        checking: false,
      },
      gemini: {
        installed: false,
        checking: false,
      },
      qwen: {
        installed: false,
        checking: false,
      },
      glm: {
        installed: false,
        checking: false,
      },
    };

    // Check Claude Code CLI installation
    const claudeStatus = await checkClaudeCodeCLI();
    status.claude = {
      installed: claudeStatus.installed,
      version: claudeStatus.version,
      checking: false,
      error: claudeStatus.error,
    };

    const codexStatus = await checkCodexCLI();
    status.codex = {
      installed: codexStatus.installed,
      version: codexStatus.version,
      checking: false,
      error: codexStatus.error,
      models: CODEX_MODEL_DEFINITIONS.map(model => model.id),
    };

    const cursorStatus = await checkCursorCLI();
    status.cursor = {
      installed: cursorStatus.installed,
      version: cursorStatus.version,
      checking: false,
      error: cursorStatus.error,
      models: CURSOR_MODEL_DEFINITIONS.map((model) => model.id),
    };

    const qwenStatus = await checkQwenCLI();
    status.qwen = {
      installed: qwenStatus.installed,
      version: qwenStatus.version,
      checking: false,
      error: qwenStatus.error,
      models: QWEN_MODEL_DEFINITIONS.map((model) => model.id),
    };

    const glmStatus = claudeStatus;
    status.glm = {
      installed: glmStatus.installed,
      version: glmStatus.version,
      checking: false,
      error: glmStatus.error,
      models: GLM_MODEL_DEFINITIONS.map((model) => model.id),
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('[API] Failed to check CLI status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check CLI status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
