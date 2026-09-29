import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
    private readonly intervalMs = 60_000,
    private readonly timerApi: TimerApi = globalThis,
  ) {}

  onModuleInit(): void {
    this.timer = this.timerApi.setInterval(() => this.media.cleanup(), this.intervalMs);
    const timer = this.timer as { unref?: () => void };
    timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer === undefined) return;
    this.timerApi.clearInterval(this.timer);
    this.timer = undefined;
  }
}
