import assert from 'node:assert/strict';
import test from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PERMISSION_CODES } from './permission-codes';

test('PERMISSION_CODES cobre exatamente os códigos semeados em prisma/seed.ts', () => {
  const seedPath = path.resolve(__dirname, '../../../../prisma/seed.ts');
  const seed = fs.readFileSync(seedPath, 'utf8');
  const seeded = [...seed.matchAll(/code:\s*'([a-z_]+\.[a-z_]+)'/g)].map((match) => match[1]);

  assert.ok(seeded.length >= 60, `esperava o catálogo semeado, encontrei ${seeded.length}`);

  const declared = [...PERMISSION_CODES].sort();
  assert.deepEqual(declared, [...new Set(seeded)].sort());
});

test('não há código duplicado', () => {
  assert.equal(PERMISSION_CODES.length, new Set(PERMISSION_CODES).size);
});