import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

export interface TemporaryAudioStore {
  put(audio: Buffer, mimeType: string, expiresAt: number): Promise<string>;
  get(key: string): Promise<{ audio: Buffer; mimeType: string } | undefined>;
  cleanup(now: number): Promise<void>;
}

interface TemporaryAudio {
  audio: Buffer;
  mimeType: string;
  expiresAt: number;
}

class MemoryAudioStore implements TemporaryAudioStore {
  private readonly objects = new Map<string, TemporaryAudio>();

  async put(audio: Buffer, mimeType: string, expiresAt: number): Promise<string> {
    const key = randomUUID();
    this.objects.set(key, { audio, mimeType, expiresAt });
    return key;
  }

  async get(key: string): Promise<{ audio: Buffer; mimeType: string } | undefined> {
    const object = this.objects.get(key);
    if (!object || object.expiresAt <= Date.now()) {
      if (object) this.objects.delete(key);
      return undefined;
    }
    return { audio: object.audio, mimeType: object.mimeType };
  }

  async cleanup(now: number): Promise<void> {
    for (const [key, object] of this.objects) if (object.expiresAt <= now) this.objects.delete(key);
  }
}

class S3AudioStore implements TemporaryAudioStore {
  constructor(private readonly client: S3Client, private readonly bucket: string, private readonly retentionMs: number) {}

  async put(audio: Buffer, mimeType: string, expiresAt: number): Promise<string> {
    const key = `ai-audio/${randomUUID()}`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: key, Body: audio, ContentType: mimeType,
      Metadata: { 'expires-at': String(expiresAt) },
    }));
    return key;
  }

  async get(key: string): Promise<{ audio: Buffer; mimeType: string } | undefined> {
    let head;
    try { head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })); } catch { return undefined; }
    const expiresAt = Number(head.Metadata?.['expires-at']);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      return undefined;
    }
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const body = result.Body;
      if (!body) return undefined;
      return { audio: Buffer.from(await body.transformToByteArray()), mimeType: result.ContentType ?? 'application/octet-stream' };
    } catch { return undefined; }
  }

  async cleanup(_now: number): Promise<void> {
    // S3 lifecycle rules provide shared cleanup; expiry is enforced on every read.
  }
}

export interface TemporaryAudioOptions {
  retentionMs?: number;
  store?: TemporaryAudioStore;
  s3?: { endpoint?: string; accessKey?: string; secretKey?: string; bucket?: string; region?: string };
  environment?: string;
}

@Injectable()
export class TemporaryAudioService {
  private readonly retentionMs: number;
  private readonly store: TemporaryAudioStore;

  constructor(options: TemporaryAudioOptions = {}) {
    this.retentionMs = options.retentionMs ?? 5 * 60_000;
    if (options.store) {
      this.store = options.store;
      return;
    }
    const s3 = options.s3;
    if (s3?.bucket && s3.accessKey && s3.secretKey) {
      this.store = new S3AudioStore(new S3Client({
        region: s3.region ?? 'us-east-1', endpoint: s3.endpoint,
        forcePathStyle: !!s3.endpoint,
        credentials: { accessKeyId: s3.accessKey, secretAccessKey: s3.secretKey },
      }), s3.bucket, this.retentionMs);
      return;
    }
    if ((options.environment ?? process.env.NODE_ENV) === 'production') {
      throw new Error('AI temporary audio requires shared S3/object storage in production');
    }
    this.store = new MemoryAudioStore();
  }

  put(audio: Buffer, mimeType: string): Promise<string> {
    return this.store.put(audio, mimeType, Date.now() + this.retentionMs);
  }

  get(key: string): Promise<{ audio: Buffer; mimeType: string } | undefined> {
    return this.store.get(key);
  }

  cleanup(now = Date.now()): Promise<void> {
    return this.store.cleanup(now);
  }
}
