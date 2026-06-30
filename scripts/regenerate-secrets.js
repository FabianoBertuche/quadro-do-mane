#!/usr/bin/env node
/**
 * Regenerate only ENCRYPTION_KEY in both .env files.
 * Usage: node scripts/regenerate-secrets.js
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Paths to update (relative to root)
const envFiles = ['.env', 'apps/api/.env'];

// Generate new key (32 bytes = 64 hex chars)
const NEW_KEY = crypto.randomBytes(32).toString('hex');

// Process each file
for (const filePath of envFiles) {
  const fullPath = path.resolve(process.cwd(), filePath);
  
  // Guard: skip if file doesn't exist
  if (!fs.existsSync(fullPath)) {
    continue;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    const newLines = [];

    for (const line of lines) {
      if (line.startsWith('ENCRYPTION_KEY=')) {
        newLines.push(`ENCRYPTION_KEY="${NEW_KEY}"`);
      } else {
        newLines.push(line);
      }
    }

    fs.writeFileSync(fullPath, newLines.join('\n'), 'utf-8');
    console.log(`OK: ${filePath} updated with ENCRYPTION_KEY of ${NEW_KEY.length} chars`);
  } catch (error) {
    console.error(`Failed to update ${filePath}:`, error.message);
    process.exit(1);
  }
}