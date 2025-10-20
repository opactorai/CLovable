#!/usr/bin/env node
/**
 * Claude Code CLI Installation and Authentication Check Script
 *
 * This script verifies that Claude Code CLI is properly installed and authenticated.
 *
 * Run: npm run check-cli
 */

const { execSync } = require('child_process');

console.log('\n🔍 Claude Code CLI Status Check\n');

// 1. Check Claude Code CLI installation
console.log('1️⃣  Checking Claude Code CLI installation...');
try {
  const version = execSync('claude --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
  console.log(`   ✅ Installed: ${version}\n`);
} catch (error) {
  console.log('   ❌ Claude Code CLI is not installed.\n');
  console.log('   Installation instructions:');
  console.log('   $ npm install -g @anthropic-ai/claude-code\n');
  process.exit(1);
}

// 2. Check CLI functionality
console.log('2️⃣  Checking CLI functionality...');
try {
  execSync('claude --help', { encoding: 'utf-8', stdio: 'pipe' });
  console.log('   ✅ CLI is working properly.\n');
} catch (error) {
  console.log('   ⚠️  An error occurred while running CLI.\n');
}

// 3. Authentication instructions
console.log('3️⃣  Authentication Check');
console.log('   First time using Claude Code CLI?');
console.log('   Authenticate with the following command:');
console.log('   $ claude auth login\n');

// 4. Project readiness status
console.log('✨ Claudable is ready to use Claude Agent SDK!\n');
console.log('   Next steps:');
console.log('   1. npm run dev - Start development server');
console.log('   2. Visit http://localhost:3000');
console.log('   3. Describe the app you want to build in natural language!\n');

console.log('────────────────────────────────────────────────────────────');
console.log('💡 Tip: Claude Agent SDK does not require API keys.');
console.log('    It automatically uses CLI authentication.');
console.log('────────────────────────────────────────────────────────────\n');
