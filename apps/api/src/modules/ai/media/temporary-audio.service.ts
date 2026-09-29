import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

interface TemporaryAudio {
  audio: Buffer;
  mimeType: string;
  expiresAt: number;
}

@Injectable()
export class TemporaryAudioService {
  private readonly objects = new Map<string, TemporaryAudio>();
  private readonly retentionMs: number;

  constructor(options: { retentionMs?: number } = {}) {
    this.retentionMs = options.retentionMs ?? 5 * 60_000;
  }

  put(audio: Buffer, mimeType: string): string {
    const key = randomUUID();
    this.objects.set(key, { audio, mimeType, expiresAt: Date.now() + this.retentionMs });
    return key;
  }

  get(key: string): { audio: Buffer; mimeType: string } | undefined {
    const object = this.objects.get(key);
    if (!object || object.expiresAt <= Date.now()) {
      if (object) this.objects.delete(key);
      return undefined;
    }
    return { audio: object.audio, mimeType: object.mimeType };
  }

  has(key: string): boolean {
    return this.objects.has(key);
  }

  cleanup(now = Date.now()): void {
    for (const [key, object] of this.objects) {
      if (object.expiresAt <= now) this.objects.delete(key);
    }
  }
}
