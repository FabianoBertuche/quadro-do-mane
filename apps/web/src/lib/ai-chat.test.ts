import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api } from './api';
import {
  cancelAction,
  confirmAction,
  createConversation,
  listConversations,
  listMessages,
  sendTextMessage,
} from './ai-chat';

test('lists global conversations through the authenticated API', async () => {
  const originalGet = api.get;
  let request: string | undefined;
  api.get = (async (url: string) => {
    request = url;
    return { data: [{ id: 'conversation-1', contextProjectId: null }] };
  }) as typeof api.get;

  try {
    assert.deepEqual(await listConversations(), [{ id: 'conversation-1', contextProjectId: null }]);
    assert.equal(request, '/ai/conversations');
  } finally {
    api.get = originalGet;
  }
});

test('creates a conversation with project context only when explicitly provided', async () => {
  const originalPost = api.post;
  const requests: Array<{ url: string; data?: unknown }> = [];
  api.post = (async (url: string, data?: unknown) => {
    requests.push({ url, data });
    return { data: { id: `conversation-${requests.length}`, contextProjectId: data ? (data as any).contextProjectId : null } };
  }) as typeof api.post;

  try {
    await createConversation();
    await createConversation('project-1');
    assert.deepEqual(requests, [
      { url: '/ai/conversations', data: {} },
      { url: '/ai/conversations', data: { contextProjectId: 'project-1' } },
    ]);
  } finally {
    api.post = originalPost;
  }
});

test('maps message history and sends text with the strict TEXT response mode', async () => {
  const originalGet = api.get;
  const originalPost = api.post;
  const requests: Array<{ method: string; url: string; data?: unknown }> = [];
  api.get = (async (url: string) => {
    requests.push({ method: 'GET', url });
    return { data: { messages: [{ id: 'message-1', role: 'assistant', content: 'Olá' }], pendingProposals: [] } };
  }) as typeof api.get;
  api.post = (async (url: string, data?: unknown) => {
    requests.push({ method: 'POST', url, data });
    return { data: { message: { id: 'message-2', role: 'user', content: 'Oi' }, proposals: [] } };
  }) as typeof api.post;

  try {
    assert.deepEqual(await listMessages('conversation-1'), {
      messages: [{ id: 'message-1', role: 'assistant', content: 'Olá' }],
      pendingProposals: [],
    });
    await sendTextMessage({ conversationId: 'conversation-1', text: 'Oi', responseMode: 'TEXT' });
    assert.deepEqual(requests, [
      { method: 'GET', url: '/ai/conversations/conversation-1/messages' },
      { method: 'POST', url: '/ai/conversations/conversation-1/messages', data: { text: 'Oi', responseMode: 'TEXT' } },
    ]);
  } finally {
    api.get = originalGet;
    api.post = originalPost;
  }
});

test('confirms and cancels proposals through their existing endpoints', async () => {
  const originalPost = api.post;
  const requests: string[] = [];
  api.post = (async (url: string) => {
    requests.push(url);
    return { data: url.endsWith('/confirm') ? { id: 'proposal-1', status: 'EXECUTED' } : undefined };
  }) as typeof api.post;

  try {
    assert.deepEqual(await confirmAction('proposal-1'), { id: 'proposal-1', status: 'EXECUTED' });
    await cancelAction('proposal-1');
    assert.deepEqual(requests, [
      '/ai/action-proposals/proposal-1/confirm',
      '/ai/action-proposals/proposal-1/cancel',
    ]);
  } finally {
    api.post = originalPost;
  }
});
