import assert from 'node:assert/strict';
import test from 'node:test';
import { TemporaryAudioCleanupScheduler } from './temporary-audio-cleanup.scheduler';
import { TemporaryAudioService } from './temporary-audio.service';

test('scheduled cleanup removes expired audio without a later read', () => {
  const media = new TemporaryAudioService({ retentionMs: 0 });
  const key = media.put(Buffer.from('expired'), 'audio/mpeg');
  let tick: (() => void) | undefined;
  let cleared: unknown;
  const scheduler = new TemporaryAudioCleanupScheduler(media, 10, {
    setInterval: (callback: () => void) => { tick = callback; return 'timer' as any; },
    clearInterval: (timer: unknown) => { cleared = timer; },
  });

  scheduler.onModuleInit();
  tick!();

  assert.equal(media.has(key), false);
  scheduler.onModuleDestroy();
  assert.equal(cleared, 'timer');
});
