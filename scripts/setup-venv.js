#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const apiDir = path.join(__dirname, '..', 'apps', 'api');
const venvDir = path.join(apiDir, '.venv');
const isWindows = os.platform() === 'win32';

// Check if uv is available
function hasUv() {
  try {
    execSync('uv --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Python executable names to try
const pythonCommands = ['python3', 'python', 'py'];

function findPython() {
  for (const cmd of pythonCommands) {
    try {
      const version = execSync(`${cmd} --version`, { encoding: 'utf8' }).trim();
      console.log(`  Found ${version}`);
      return cmd;
    } catch {
      continue;
    }
  }
  
  console.error('\nPython not found!');
  console.error('\nHow to fix:');
  if (os.platform() === 'darwin') {
    console.error('   Mac: brew install python@3.12');
  } else if (os.platform() === 'win32') {
    console.error('   Windows: Download from https://python.org');
    console.error('   IMPORTANT: Check "Add Python to PATH" during installation');
  } else {
    console.error('   Linux: sudo apt install python3 python3-venv');
  }
  console.error('\n   Then run: npm install\n');
  process.exit(1);
}

function setupWithUv() {
  console.log('Using uv for Python environment...');
  
  // Check if venv exists
  if (!fs.existsSync(venvDir)) {
    console.log('  Creating virtual environment with uv...');
    try {
      execSync('uv venv .venv', { cwd: apiDir, stdio: 'inherit' });
      console.log('  Virtual environment created');
    } catch (error) {
      console.error('  Failed to create virtual environment with uv');
      process.exit(1);
    }
  } else {
    console.log('  Virtual environment already exists');
  }
  
  // Install requirements with uv
  console.log('  Installing Python packages with uv...');
  try {
    execSync('uv pip install -r requirements.txt', { cwd: apiDir, stdio: 'ignore' });
    console.log('  Python packages installed');
  } catch (error) {
    console.error('\nFailed to install Python packages with uv');
    console.error('\nHow to fix:');
    console.error('   Option 1: cd apps/api && uv pip install -r requirements.txt');
    console.error('   Option 2: Remove .venv and try with pip:');
    console.error('             rm -rf apps/api/.venv && npm install');
    process.exit(1);
  }
  
  console.log('  Python environment ready (via uv)!');
}

function setupWithPip() {
  console.log('Setting up Python virtual environment...');
  
  const python = findPython();
  
  // Check if venv exists
  if (!fs.existsSync(venvDir)) {
    console.log('  Creating virtual environment...');
    try {
      execSync(`${python} -m venv .venv`, { cwd: apiDir, stdio: 'inherit' });
      console.log('  Virtual environment created');
    } catch (error) {
      console.error('\nFailed to create virtual environment');
      console.error('\nPossible issues:');
      console.error('   1. Missing python3-venv package (Linux)');
      console.error('      Fix: sudo apt install python3-venv');
      console.error('   2. Permission issues');
      console.error('      Fix: Check folder permissions');
      console.error('\n   Then run: npm install\n');
      process.exit(1);
    }
  } else {
    console.log('  Virtual environment already exists');
  }
  
  // Determine pip path
  const pipPath = isWindows 
    ? path.join(venvDir, 'Scripts', 'pip.exe')
    : path.join(venvDir, 'bin', 'pip');
  
  // Upgrade pip
  console.log('  Upgrading pip...');
  try {
    execSync(`"${pipPath}" install --upgrade pip`, { cwd: apiDir, stdio: 'ignore' });
  } catch {
    console.log('  Could not upgrade pip, continuing...');
  }
  
  // Install requirements
  console.log('  Installing Python packages...');
  try {
    execSync(`"${pipPath}" install -r requirements.txt`, { cwd: apiDir, stdio: 'ignore' });
    console.log('  Python packages installed');
  } catch (error) {
    console.error('\nFailed to install Python packages');
    console.error('\nHow to fix:');
    console.error('   Option 1: Install manually');
    if (isWindows) {
      console.error('      cd apps/api');
      console.error('      .venv\\Scripts\\pip install -r requirements.txt');
    } else {
      console.error('      cd apps/api');
      console.error('      source .venv/bin/activate');
      console.error('      pip install -r requirements.txt');
    }
    console.error('\n   Option 2: Clean and retry');
    console.error('      npm run clean');
    console.error('      npm install');
    console.error('\n   Option 3: Install uv for faster installation');
    console.error('      Mac: brew install uv');
    console.error('      Then: npm install');
    process.exit(1);
  }
  
  console.log('  Python environment ready!');
}

// Main setup function
function setup() {
  if (hasUv()) {
    setupWithUv();
  } else {
    setupWithPip();
  }
}

// Run setup
setup();
