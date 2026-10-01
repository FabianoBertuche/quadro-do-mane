import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getNextAiModelIndex } from './AiModelCombobox';

test('wraps keyboard navigation across the filtered model list', () => {
  assert.equal(getNextAiModelIndex(0, 3, 'ArrowUp'), 2);
  assert.equal(getNextAiModelIndex(2, 3, 'ArrowDown'), 0);
  assert.equal(getNextAiModelIndex(1, 3, 'Home'), 0);
  assert.equal(getNextAiModelIndex(1, 3, 'End'), 2);
});
