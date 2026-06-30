#!/usr/bin/env node
/**
 * Bootstrap and start Quadro do Mané (cross-platform).
 * Usage: node scripts/start-all.js [--help]
 */

'use strict';

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse CLI arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Quadro do Mané — Bootstrap + Start

Usage: node scripts/start-all.js

Prerequisites:
- Docker Desktop running
- Node 20+, npm 10+

This script:
1. Generates .env with strong secrets (if missing)
2. Starts Postgres + Redis via Docker Compose
3. Installs dependencies
4. Applies Prisma migrations and generates client
5. Seeds database
6. Starts API (port 3001) and Web (port 3000)

Press Ctrl+C to stop all services.
`);
  process.exit(0);
}

// Configuration
const rootDir = process.cwd();
const apiDir = path.join(rootDir, 'apps', 'api');
const webDir = path.join(rootDir, 'apps', 'web');

// Helper to run a command synchronously
function runCommand(command, cwd = rootDir, options = {}) {
  console.log(`> ${command}`);
  try {
    execSync(command, {
      cwd,
      stdio: 'inherit',
      shell: true,
      ...options,
    });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

// Helper to wait for a specified number of milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main async function
async function main() {
  console.log('================================================');
  console.log('  Quadro do Mané — Bootstrap + Start');
  console.log('================================================');

  // 1. Generate .env if missing
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) {
    console.log('[1/7] Generating .env with strong secrets...');
    runCommand('node scripts/generate-env.js');
  } else {
    console.log('[1/7] .env already exists, keeping.');
  }

  // 2. Start Docker Compose
  console.log('[2/7] Starting Postgres + Redis (Docker Compose)...');
  runCommand('docker compose up -d');

  console.log('  Waiting for Postgres (15s)...');
  await sleep(15000);

  // 3. Install dependencies
  console.log('[3/7] Installing dependencies...');
  runCommand('npm install --silent');

  // 4. Prisma migrations + generate
  console.log('[4/7] Applying migrations and generating Prisma Client...');
  runCommand('npx prisma migrate deploy', apiDir);
  runCommand('npx prisma generate', apiDir);

  // 5. Seed database
  console.log('[5/7] Running seed...');
  runCommand('npm run seed', apiDir);

  // 6. Start API in background
  console.log('[6/7] Starting API on port 3001...');
  const apiProcess = spawn('npm', ['run', 'dev'], {
    cwd: apiDir,
    stdio: 'inherit',
    shell: true,
  });

  // 7. Start Web in background
  console.log('[7/7] Starting Web on port 3000...');
  const webProcess = spawn('npm', ['run', 'dev'], {
    cwd: webDir,
    stdio: 'inherit',
    shell: true,
  });

  // Store PIDs for cleanup
  const apiPid = apiProcess.pid;
  const webPid = webProcess.pid;

  console.log('');
  console.log('================================================');
  console.log('  Services started!');
  console.log('================================================');
  console.log('  API:    http://localhost:3001/api');
  console.log('  Docs:   http://localhost:3001/api/docs');
  console.log('  Web:    http://localhost:3000');
  console.log('');
  console.log('  Default login:');
  console.log('    Email:    admin@quadrodomane.local');
  console.log('    Password: AlterarNoPrimeiroLogin123!');
  console.log('');
  console.log(`  PIDs: API=${apiPid}, Web=${webPid}`);
  console.log('  Press Ctrl+C to stop all services');
  console.log('================================================');

  // Helper to kill a process tree
  function killProcessTree(process) {
    try {
      // On Windows, we need to kill the process tree
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${process.pid} /T /F`, { stdio: 'ignore' });
      } else {
        process.kill('SIGTERM');
      }
    } catch (error) {
      // Ignore errors (process may already be dead)
    }
  }

  // Cleanup function
  function cleanup() {
    console.log('\nStopping services...');
    killProcessTree(apiProcess);
    killProcessTree(webProcess);
    console.log('Services stopped.');
    process.exit(0);
  }

  // Handle Ctrl+C
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Wait for processes to exit (they shouldn't unless there's an error)
  await Promise.all([
    new Promise((resolve) => apiProcess.on('exit', resolve)),
    new Promise((resolve) => webProcess.on('exit', resolve)),
  ]);

  // If we get here, one of the processes exited unexpectedly
  console.error('One of the services exited unexpectedly.');
  cleanup();
}

// Run the main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});