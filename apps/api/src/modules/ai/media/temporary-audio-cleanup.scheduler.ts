import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { TemporaryAudioService } from './temporary-audio.service';

interface TimerApi {
  setInterval(callback: () => void, delay: number): unknown;
  clearInterval(timer: unknown): void;
}

@Injectable()
export class TemporaryAudioCleanupScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: unknown;

  constructor(
    private readonly media: TemporaryAudioService,
    @Optional() private readonly intervalMs = 60_000,
    @Optional() private readonly timerApi: TimerApi = globalThis,
  ) {}

  onModuleInit(): void {
    this.timer = this.timerApi.setInterval(() => { void this.media.cleanup(); }, this.intervalMs);
    const timer = this.timer as { unref?: () => void };
    timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer === undefined) return;
    this.timerApi.clearInterval(this.timer);
    this.timer = undefined;
  }
}
