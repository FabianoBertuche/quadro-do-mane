import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldCloseAfterTaskCreation } from './task-form';

test('closes after creating a task without attachments', () => {
  assert.equal(shouldCloseAfterTaskCreation(0, false), true);
});

test('closes after automatic attachment uploads finish', () => {
  assert.equal(shouldCloseAfterTaskCreation(2, false), true);
});

test('keeps the form open when an attachment upload fails', () => {
  assert.equal(shouldCloseAfterTaskCreation(1, true), false);
});
