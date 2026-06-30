import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Payload criptografado retornado pelo EncryptionService.
 * Cada ciphertext deve ser persistido junto com seu IV e authTag (GCM).
 */
export interface EncryptedPayload {
  /** Texto cifrado em hexadecimal */
  ciphertext: string;
  /** Vetor de inicialização aleatório (12 bytes para GCM) em hexadecimal */
  iv: string;
  /** Tag de autenticação GCM (16 bytes) em hexadecimal */
  authTag: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits é o recomendado para GCM
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const hex = this.config.get<string>('ENCRYPTION_KEY');
    if (!hex) {
      throw new Error('ENCRYPTION_KEY is required (32 bytes hex = 64 chars).');
    }

    const key = Buffer.from(hex, 'hex');
    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}). ` +
          `Generate with: openssl rand -hex 32`,
      );
    }

    this.key = key;
    this.logger.log(`EncryptionService ready (AES-256-GCM, ${KEY_LENGTH}-byte key)`);
  }

  /**
   * Criptografa texto plano. IV e authTag são gerados aleatoriamente por chamada.
   */
  encrypt(plaintext: string): EncryptedPayload {
    if (typeof plaintext !== 'string') {
      throw new TypeError('encrypt() expects a string');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Descriptografa um payload previamente gerado por encrypt().
   * Lança erro se a authTag não bater (mensagem adulterada).
   */
  decrypt(payload: EncryptedPayload): string {
    if (!payload?.ciphertext || !payload?.iv || !payload?.authTag) {
      throw new Error('Encrypted payload must contain ciphertext, iv and authTag');
    }

    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');
    const ciphertext = Buffer.from(payload.ciphertext, 'hex');

    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid authTag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }

  /**
   * Hash determinístico (SHA-256) usado para indexar tokens na denylist Redis.
   * Não é criptografia — é fingerprint.
   */
  hash(value: string): string {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
  }
}