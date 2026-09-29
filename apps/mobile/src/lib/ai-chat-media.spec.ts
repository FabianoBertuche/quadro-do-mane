import { describe, expect, it } from 'vitest';
import { downloadAuthenticatedAudio } from './ai-chat-media-state';

describe('authenticated AI audio download', () => {
  it('downloads through the API client before handing playback a local URI', async () => {
    const calls: unknown[] = [];
    const result = await downloadAuthenticatedAudio('audio/key', {
      get: async (path: string, config: unknown) => {
        calls.push([path, config]);
        return { data: new ArrayBuffer(2) };
      },
    }, async (data) => `file:///cache/${data.byteLength}.m4a`);

    expect(calls).toEqual([['/ai/audio/audio%2Fkey', { responseType: 'arraybuffer' }]]);
    expect(result).toBe('file:///cache/2.m4a');
  });
});
