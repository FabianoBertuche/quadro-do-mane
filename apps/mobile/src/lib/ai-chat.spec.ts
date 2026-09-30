import { describe, expect, it, vi } from 'vitest';
import {
  createProposalState,
  createRecordingMachine,
  createRecordingLifecycle,
  getResponseMode,
  mergeHistoryPage,
  stopAndCancelRecording,
  setResponseMode,
  type AiResponseMode,
} from './ai-chat-state';
vi.mock('./api', () => ({ api: {} }));
import { hasProposalControls, resolveProposalStatus, selectConversation, type AiConversation } from './ai-chat';

describe('AI chat recording machine', () => {
  it('starts on press and submits on release', () => {
    const machine = createRecordingMachine();

    expect(machine.press()).toEqual({ state: 'recording', cancelled: false });
    expect(machine.release()).toEqual({ state: 'submitted', cancelled: false });
  });

  it('locks after an upward drag and submits on release', () => {
    const machine = createRecordingMachine({ lockThreshold: 48 });

    machine.press();
    expect(machine.move(-49)).toEqual({ state: 'locked', cancelled: false });
    expect(machine.release()).toEqual({ state: 'submitted', cancelled: false });
  });

  it('cancels when the gesture enters the cancel zone', () => {
    const machine = createRecordingMachine({ cancelThreshold: 100 });

    machine.press();
    expect(machine.move(100)).toEqual({ state: 'cancelled', cancelled: true });
    expect(machine.release()).toEqual({ state: 'idle', cancelled: true });
  });

  it('exposes an explicit cancel transition for native recorder cleanup', () => {
    const machine = createRecordingMachine();

    machine.press();
    expect(machine.cancel()).toEqual({ state: 'cancelled', cancelled: true });
    expect(machine.release()).toEqual({ state: 'idle', cancelled: true });
  });

  it('stops the native recorder before resetting cancelled state', async () => {
    const calls: string[] = [];
    await stopAndCancelRecording(async () => { calls.push('stop'); }, () => { calls.push('reset'); });
    expect(calls).toEqual(['stop', 'reset']);
  });

  it('cancels a pending start and stops after the native start promise resolves', async () => {
    const lifecycle = createRecordingLifecycle();
    let resolveStart!: (started: boolean) => void;
    let stopCalls = 0;
    const startPromise = new Promise<boolean>((resolve) => { resolveStart = resolve; });

    lifecycle.begin();
    const starting = lifecycle.start(() => startPromise, async () => { stopCalls += 1; });
    await lifecycle.cancel(async () => { stopCalls += 1; });
    resolveStart(true);

    expect(await starting).toBe(false);
    expect(stopCalls).toBe(1);
  });

  it('prevents recorder start when cancellation wins before preparation completes', async () => {
    const lifecycle = createRecordingLifecycle();
    let resolvePreparation!: () => void;
    let recordCalls = 0;
    let stopCalls = 0;
    const preparation = new Promise<void>((resolve) => { resolvePreparation = resolve; });

    lifecycle.begin();
    const starting = lifecycle.start(async () => {
      await preparation;
      if (!lifecycle.canStart()) return false;
      recordCalls += 1;
      return true;
    }, async () => { stopCalls += 1; });
    await lifecycle.cancel(async () => { stopCalls += 1; });
    resolvePreparation();

    expect(await starting).toBe(false);
    expect(recordCalls).toBe(0);
    expect(stopCalls).toBe(0);
  });
});

describe('AI chat response mode and proposals', () => {
  it('keeps clarification proposals pending after confirmation', () => {
    expect(resolveProposalStatus('PENDING', 'EXECUTED')).toBe('PENDING');
  });

  it('keeps confirmation and cancellation controls visible for clarification proposals', () => {
    expect(hasProposalControls('PENDING')).toBe(true);
    expect(hasProposalControls('EXECUTED')).toBe(false);
  });

  it('does not reuse a project conversation for global chat', () => {
    const projectConversation = { id: 'project-chat', contextProjectId: 'project-1' } satisfies AiConversation;

    expect(selectConversation([projectConversation])).toBeUndefined();
  });

  it('selects only the requested project conversation for project chat', () => {
    const conversations = [
      { id: 'global' },
      { id: 'project-chat', contextProjectId: 'project-1' },
    ] satisfies AiConversation[];

    expect(selectConversation(conversations, 'project-1')?.id).toBe('project-chat');
    expect(selectConversation(conversations, 'project-2')).toBeUndefined();
  });

  it('persists response mode independently per conversation', () => {
    const modes = new Map<string, AiResponseMode>();

    expect(getResponseMode(modes, 'conversation-1')).toBe('TEXT');
    setResponseMode(modes, 'conversation-1', 'AUDIO');
    setResponseMode(modes, 'conversation-2', 'TEXT');

    expect(getResponseMode(modes, 'conversation-1')).toBe('AUDIO');
    expect(getResponseMode(modes, 'conversation-2')).toBe('TEXT');
  });

  it('transitions a proposal from pending to confirmed or cancelled', () => {
    const pending = createProposalState('proposal-1');

    expect(pending.confirm()).toEqual({ id: 'proposal-1', status: 'confirmed' });
    expect(pending.cancel()).toEqual({ id: 'proposal-1', status: 'cancelled' });
  });

  it('appends later history pages without duplicating messages', () => {
    const first = [{ id: 'one' }, { id: 'two' }] as any;
    const next = [{ id: 'two' }, { id: 'three' }] as any;

    expect(mergeHistoryPage(first, next)).toEqual([{ id: 'one' }, { id: 'two' }, { id: 'three' }]);
  });
});
