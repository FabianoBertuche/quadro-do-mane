#!/usr/bin/env node
/**
 * Kill processes listening on a specified port.
 * Usage: node scripts/kill-port.js <port>
 */

'use strict';

const { execSync } = require('child_process');
const os = require('os');

// Parse CLI arguments
const args = process.argv.slice(2);
const port = parseInt(args[0], 10);

// Guard: port must be provided
if (args.length === 0 || isNaN(port)) {
  console.error('Usage: node scripts/kill-port.js <port>');
  process.exit(1);
}

// Guard: port must be in valid range
if (port < 1 || port > 65535) {
  console.error('Port must be between 1 and 65535');
  process.exit(1);
}

console.log(`Killing processes on port ${port}...`);

try {
  if (os.platform() === 'win32') {
    // Windows: use netstat to find PIDs, then taskkill
    let output = '';
    try {
      output = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // findstr exits with 1 when no matches — that's fine, means port is free
      console.log(`No processes found listening on port ${port}`);
      process.exit(0);
    }

    const lines = output.split('\n').filter(line => line.trim() !== '');
    const pids = new Set();

    for (const line of lines) {
      const match = line.match(/LISTENING\s+(\d+)$/);
      if (match) {
        pids.add(match[1]);
      }
    }

    if (pids.size === 0) {
      console.log(`No processes found listening on port ${port}`);
      process.exit(0);
    }

    for (const pid of pids) {
      console.log(`Killing PID ${pid}`);
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      } catch (error) {
        console.log(`Failed to kill PID ${pid} (may have already exited)`);
      }
    }
  } else {
    // Unix-like: use lsof or fuser
    let output = '';
    try {
      // Try lsof first
      output = execSync(`lsof -ti:${port}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // lsof exits with 1 when no matches — try fuser as fallback
      try {
        execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
        console.log(`Killed processes on port ${port}`);
        process.exit(0);
      } catch {
        // fuser also failed — port is likely free
        console.log(`No processes found listening on port ${port}`);
        process.exit(0);
      }
    }

    const pids = output.split('\n').filter(pid => pid.trim() !== '');
    if (pids.length === 0) {
      console.log(`No processes found listening on port ${port}`);
      process.exit(0);
    }

    for (const pid of pids) {
      console.log(`Killing PID ${pid}`);
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      } catch (error) {
        console.log(`Failed to kill PID ${pid} (may have already exited)`);
      }
    }
  }

  console.log(`Done cleaning up port ${port}`);
} catch (error) {
  console.error(`Error cleaning up port ${port}:`, error.message);
  process.exit(1);
}