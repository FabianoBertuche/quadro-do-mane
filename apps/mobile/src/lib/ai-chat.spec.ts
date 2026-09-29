import { describe, expect, it } from 'vitest';
import {
  createProposalState,
  createRecordingMachine,
  getResponseMode,
  setResponseMode,
  type AiResponseMode,
} from './ai-chat-state';

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
});

describe('AI chat response mode and proposals', () => {
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
});
