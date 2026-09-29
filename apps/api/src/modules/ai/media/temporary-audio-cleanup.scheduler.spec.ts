import assert from 'node:assert/strict';
import test from 'node:test';
import { TemporaryAudioCleanupScheduler } from './temporary-audio-cleanup.scheduler';
import { TemporaryAudioService } from './temporary-audio.service';

test('scheduled cleanup removes expired audio without a later read', async () => {
  const media = new TemporaryAudioService({ retentionMs: 0 });
  let tick: (() => void) | undefined;
  let cleared: unknown;
  const scheduler = new TemporaryAudioCleanupScheduler(media, 10, {
    setInterval: (callback: () => void) => { tick = callback; return 'timer' as any; },
    clearInterval: (timer: unknown) => { cleared = timer; },
  });

  scheduler.onModuleInit();
  tick!();

  await new Promise((resolve) => setImmediate(resolve));
  scheduler.onModuleDestroy();
  assert.equal(cleared, 'timer');
});
