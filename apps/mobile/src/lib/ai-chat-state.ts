export type AiResponseMode = 'TEXT' | 'AUDIO';
export type RecordingState = 'idle' | 'recording' | 'locked' | 'cancelled' | 'submitted';

export function createRecordingMachine(options: { lockThreshold?: number; cancelThreshold?: number } = {}) {
  const lockThreshold = options.lockThreshold ?? 48;
  const cancelThreshold = options.cancelThreshold ?? 100;
  let state: RecordingState = 'idle';
  let cancelled = false;

  const result = (): { state: RecordingState; cancelled: boolean } => ({ state, cancelled });
  return {
    press() {
      if (state === 'idle' || state === 'cancelled' || state === 'submitted') {
        state = 'recording';
        cancelled = false;
      }
      return result();
    },
    move(deltaY: number) {
      if (state !== 'recording' && state !== 'locked') return result();
      if (deltaY >= cancelThreshold) {
        state = 'cancelled';
        cancelled = true;
      } else if (deltaY <= -lockThreshold) {
        state = 'locked';
      }
      return result();
    },
    release() {
      if (state === 'recording' || state === 'locked') state = 'submitted';
      else if (state === 'cancelled') state = 'idle';
      return result();
    },
    cancel() {
      if (state === 'recording' || state === 'locked') {
        state = 'cancelled';
        cancelled = true;
      }
      return result();
    },
    getState: result,
  };
}

export function getResponseMode(modes: Map<string, AiResponseMode>, conversationId: string): AiResponseMode {
  return modes.get(conversationId) ?? 'TEXT';
}

export function setResponseMode(modes: Map<string, AiResponseMode>, conversationId: string, mode: AiResponseMode): void {
  modes.set(conversationId, mode);
}

export function createProposalState(id: string) {
  return {
    confirm: () => ({ id, status: 'confirmed' as const }),
    cancel: () => ({ id, status: 'cancelled' as const }),
  };
}

export function mergeHistoryPage<T extends { id: string }>(current: T[], next: T[]): T[] {
  const result = [...current];
  for (const item of next) {
    if (!result.some((existing) => existing.id === item.id)) result.push(item);
  }
  return result;
}

export async function stopAndCancelRecording(stop: () => Promise<void>, reset: () => void): Promise<void> {
  try {
    await stop();
  } finally {
    reset();
  }
}
