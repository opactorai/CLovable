#!/usr/bin/env node

const { spawn } = require('child_process');

// Flag to ensure browser opens only once
let browserOpened = false;

// Check if auto-open is disabled via environment variable
const shouldOpenBrowser = process.env.BROWSER !== 'false' && process.env.BROWSER !== 'none';

// Function to open browser after a delay
const openBrowserOnce = () => {
  if (browserOpened || !shouldOpenBrowser) return;
  browserOpened = true;

  // Wait for server to be ready, then open browser
  setTimeout(async () => {
    try {
      const port = process.env.WEB_PORT || 3000;
      const url = `http://localhost:${port}`;
      // Dynamic import for ESM module
      const open = (await import('open')).default;
      await open(url);
      console.log(`\n🚀 Browser opened at ${url}`);
    } catch (error) {
      const port = process.env.WEB_PORT || 3000;
      console.log(`\n⚠️  Could not open browser automatically. Please visit http://localhost:${port} manually.`);
      console.log('Error:', error.message);
    }
  }, 4000); // 4 second delay to ensure server is ready
};

// Start Next.js dev server
const next = spawn('npx', ['next', 'dev', '--turbo'], {
  stdio: 'inherit',
  shell: true
});

// Open browser once after server starts
openBrowserOnce();

// Handle process termination
process.on('SIGINT', () => {
  next.kill('SIGINT');
  process.exit();
});

next.on('error', (error) => {
  console.error('\n❌ Failed to start Next.js dev server');
  console.error('Error:', error.message);
  process.exit(1);
});

next.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n❌ Next.js dev server exited with code ${code}`);
    process.exit(code);
  }
});
