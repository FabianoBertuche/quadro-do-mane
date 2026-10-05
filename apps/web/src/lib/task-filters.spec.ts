import assert from 'node:assert/strict';
import test from 'node:test';
import { withStatusCategory } from './task-filters';

test('preserva os demais parâmetros e adiciona statusCategory quando informada', () => {
  const params = withStatusCategory({ projectId: 'p1', search: 'relatório' }, 'active');
  assert.equal(params.get('projectId'), 'p1');
  assert.equal(params.get('search'), 'relatório');
  assert.equal(params.get('statusCategory'), 'active');
});

test('omite statusCategory quando não informada, em vez de mandá-la vazia', () => {
  const params = withStatusCategory({ projectId: 'p1' }, null);
  assert.equal(params.get('projectId'), 'p1');
  assert.equal(params.has('statusCategory'), false);
});

test('aceita URLSearchParams de entrada sem perder o que já existe', () => {
  const params = withStatusCategory(new URLSearchParams('status=OPEN'), 'done');
  assert.equal(params.get('status'), 'OPEN');
  assert.equal(params.get('statusCategory'), 'done');
});
