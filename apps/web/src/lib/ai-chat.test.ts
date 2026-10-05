import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api } from './api';
import {
  cancelAction,
  confirmAction,
  createOptimisticAiMessage,
  createConversation,
  getClarificationDetails,
  listConversations,
  listMessages,
  mergeAiMessageResponse,
  sendAudioMessage,
  sendTextMessage,
} from './ai-chat';

test('creates an immediate optimistic user message with sending state', () => {
  assert.deepEqual(createOptimisticAiMessage(' Organizar tarefas ', 'optimistic-1'), {
    id: 'optimistic-1',
    role: 'user',
    content: 'Organizar tarefas',
    format: 'TEXT',
    localStatus: 'sending',
  });
});

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

test('requests additional conversation pages with explicit pagination', async () => {
  const originalGet = api.get;
  let request: { url: string; config?: unknown } | undefined;
  api.get = (async (url: string, config?: unknown) => {
    request = { url, config };
    return { data: [{ id: 'conversation-21', contextProjectId: null }] };
  }) as typeof api.get;

  try {
    assert.deepEqual(await listConversations(2), [{ id: 'conversation-21', contextProjectId: null }]);
    assert.deepEqual(request, { url: '/ai/conversations', config: { params: { page: 2, take: 20 } } });
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

test('preserves conversation creation errors for the page to display', async () => {
  const originalPost = api.post;
  const failure = new Error('creation failed');
  api.post = (async () => { throw failure; }) as typeof api.post;

  try {
    await assert.rejects(() => createConversation(), failure);
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

test('preserves authorized tool results returned with the final assistant response', async () => {
  const originalPost = api.post;
  api.post = (async () => ({ data: {
    message: { id: 'message-1', role: 'user', content: 'Quais projetos?' },
    assistantMessage: { id: 'message-2', role: 'assistant', content: 'Você pode ver Projeto A.' },
    proposals: [],
    toolResults: [{ toolName: 'search_projects', result: [{ id: 'project-1', name: 'Projeto A' }] }],
  } })) as typeof api.post;

  try {
    const response = await sendTextMessage({ conversationId: 'conversation-1', text: 'Quais projetos?', responseMode: 'TEXT' });
    assert.deepEqual(response.toolResults, [{ toolName: 'search_projects', result: [{ id: 'project-1', name: 'Projeto A' }] }]);
    assert.equal(response.assistantMessage?.content, 'Você pode ver Projeto A.');
  } finally {
    api.post = originalPost;
  }
});

test('merges a successful send response into the cached message page', () => {
  const page = {
    messages: [{ id: 'existing', role: 'assistant' as const, content: 'Anterior' }],
    pendingProposals: [],
  };
  const response = {
    message: { id: 'user-1', role: 'user' as const, content: 'Oi' },
    assistantMessage: { id: 'assistant-1', role: 'assistant' as const, content: 'Olá' },
    proposals: [],
    toolResults: [],
  };

  assert.deepEqual(mergeAiMessageResponse(page, response), {
    messages: [page.messages[0], response.message, response.assistantMessage],
    pendingProposals: [],
  });
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
    assert.equal(await cancelAction('proposal-1'), undefined);
    assert.deepEqual(requests, [
      '/ai/action-proposals/proposal-1/confirm',
      '/ai/action-proposals/proposal-1/cancel',
    ]);
  } finally {
    api.post = originalPost;
  }
});

test('maps structured clarification details instead of dropping them', () => {
  assert.deepEqual(
    getClarificationDetails(JSON.stringify({
      status: 'needsClarification',
       result: {
         needsClarification: true,
         field: 'projectName',
         matches: [
           { id: 'project-1', name: 'Projeto Alpha' },
           { id: 'project-2', name: 'Projeto Alfa' },
         ],
       },
    })),
    {
      field: 'projectName',
       options: [
         { id: 'project-1', name: 'Projeto Alpha' },
         { id: 'project-2', name: 'Projeto Alfa' },
       ],
      message: 'Escolha um valor para projectName.',
    },
  );
});

test('maps clarification messages and ambiguous names when the field is absent', () => {
  assert.deepEqual(
    getClarificationDetails(JSON.stringify({
      status: 'needsClarification',
      result: { options: ['Ana', 'Anabela'], message: 'Qual pessoa você quis dizer?' },
    })),
     {
       options: [
         { id: 'Ana', name: 'Ana' },
         { id: 'Anabela', name: 'Anabela' },
       ],
      message: 'Qual pessoa você quis dizer?',
    },
  );
});

test('sends audio as multipart with response mode and parses the TTS key', async () => {
  const originalPost = api.post;
  const requests: Array<{ url: string; data?: unknown }> = [];
  api.post = (async (url: string, data?: unknown) => {
    requests.push({ url, data });
    return { data: {
      message: { id: 'message-1', role: 'user', content: ' transcrição ', format: 'AUDIO' },
      assistantMessage: { id: 'message-2', role: 'assistant', content: 'Feito.', audioObjectKey: 'audio/key-1' },
      proposals: [],
      toolResults: [],
    } };
  }) as typeof api.post;

  try {
    const audio = new Blob(['fake-audio'], { type: 'audio/webm' });
    const response = await sendAudioMessage({ conversationId: 'conversation-1', audio, filename: 'comando.webm', responseMode: 'AUDIO' });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/ai/conversations/conversation-1/audio');
    const form = requests[0].data as FormData;
    assert.ok(form instanceof FormData);
    assert.equal(form.get('responseMode'), 'AUDIO');
    const file = form.get('audio');
    assert.ok(file instanceof Blob);
    assert.equal(response.message.content, ' transcrição ');
    assert.equal(response.assistantMessage?.audioObjectKey, 'audio/key-1');
  } finally {
    api.post = originalPost;
  }
});

test('keeps the TTS audio key on text responses for the player', async () => {
  const originalPost = api.post;
  api.post = (async () => ({ data: {
    message: { id: 'message-1', role: 'user', content: 'Oi' },
    assistantMessage: { id: 'message-2', role: 'assistant', content: 'Olá em voz.', audioObjectKey: 'audio/key-2' },
    proposals: [],
    toolResults: [],
  } })) as typeof api.post;

  try {
    const response = await sendTextMessage({ conversationId: 'conversation-1', text: 'Oi', responseMode: 'AUDIO' });
    assert.equal(response.assistantMessage?.audioObjectKey, 'audio/key-2');
  } finally {
    api.post = originalPost;
  }
});
