#!/usr/bin/env node
/**
 * Start both API and Web in dev mode (cross-platform).
 * Usage: node scripts/dev-all.js [--help]
 *
 * This is a lightweight alternative to `start-all.js`:
 * no Docker, no migrations, no seed — just start the dev servers.
 */

'use strict';

const { execSync, spawn } = require('child_process');
const path = require('path');

// --- Guard: CLI help ---
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Quadro do Mané — Dev Mode

Usage: node scripts/dev-all.js

Starts both API (port 3001) and Web (port 3000) in dev/watch mode.
No Docker, no migrations, no seed — assumes infrastructure is already running.

Press Ctrl+C to stop both services.
`);
  process.exit(0);
}

// --- Configuration ---
const rootDir = process.cwd();
const apiDir = path.join(rootDir, 'apps', 'api');
const webDir = path.join(rootDir, 'apps', 'web');

// --- Helper: kill a process tree ---
function killProcessTree(child) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch (_) {
    // Process may already be dead — ignore.
  }
}

// --- Main ---
async function main() {
  console.log('================================================');
  console.log('  Quadro do Mané — Dev Mode');
  console.log('================================================');
  console.log('');

  // Start API (port 3001)
  console.log('Starting API on port 3001...');
  const apiProcess = spawn('npm', ['run', 'dev'], {
    cwd: apiDir,
    stdio: 'inherit',
    shell: true,
  });

  // Start Web (port 3000)
  console.log('Starting Web on port 3000...');
  const webProcess = spawn('npm', ['run', 'dev'], {
    cwd: webDir,
    stdio: 'inherit',
    shell: true,
  });

  console.log('');
  console.log('================================================');
  console.log('  Dev servers starting!');
  console.log('================================================');
  console.log('  API:  http://localhost:3001/api');
  console.log('  Docs: http://localhost:3001/api/docs');
  console.log('  Web:  http://localhost:3000');
  console.log('');
  console.log(`  PIDs: API=${apiProcess.pid}, Web=${webProcess.pid}`);
  console.log('  Press Ctrl+C to stop both services');
  console.log('================================================');

  // --- Cleanup ---
  function cleanup() {
    console.log('\nStopping dev servers...');
    killProcessTree(apiProcess);
    killProcessTree(webProcess);
    console.log('Dev servers stopped.');
    process.exit(0);
  }

  // Handle Ctrl+C and termination signals
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Wait for either process to exit (unexpected exit)
  await Promise.all([
    new Promise((resolve) => apiProcess.on('exit', resolve)),
    new Promise((resolve) => webProcess.on('exit', resolve)),
  ]);

  // If we reach here, a process exited unexpectedly
  console.error('One of the dev servers exited unexpectedly.');
  cleanup();
}

// --- Entry point ---
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
