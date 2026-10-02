import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';
import { UploadService } from './upload.service';
import { ALLOWED_MIMES, MAX_FILE_SIZE } from './upload.constants';

export const ATTACHMENT_FETCH = Symbol('ATTACHMENT_FETCH');
export const MAX_REDIRECTS = 2;
const REQUEST_TIMEOUT_MS = 10_000;

export type AttachmentFetch = (
  url: string,
  init: { redirect: 'manual'; signal?: AbortSignal },
) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export type DnsLookup = (hostname: string, options: { all: true }) => Promise<Array<{ address: string; family: number }>>;

const ipv4Value = (address: string) => address.split('.').reduce((value, part) => (value << 8) + Number(part), 0);

const ipv6Value = (address: string): bigint => {
  const normalizedAddress = address.toLowerCase().replace(/(\d+\.\d+\.\d+\.\d+)$/, (ipv4) => {
    const value = ipv4Value(ipv4);
    return `${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`;
  });
  const [head, tail = ''] = normalizedAddress.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const missing = 8 - headParts.length - tailParts.length;
  const parts = [...headParts, ...Array(Math.max(missing, 0)).fill('0'), ...tailParts];
  return parts.reduce((value, part) => (value << 16n) + BigInt(`0x${part || '0'}`), 0n);
};

export const isBlockedAddress = (address: string): boolean => {
  if (net.isIPv4(address)) {
    const value = ipv4Value(address);
    return value >>> 24 === 0
      || value >>> 24 === 10
      || value >>> 24 === 127
      || value >>> 16 === 0xa9fe
      || value >>> 20 === 0xac1
      || value >>> 16 === 0xc0a8
      || value >>> 22 === 0x191
      || value >>> 28 >= 14;
  }

  if (!net.isIPv6(address)) return true;
  const value = ipv6Value(address);
  const mappedPrefix = value >> 32n;
  if (mappedPrefix === 0xffffn || mappedPrefix === 0n) {
    const mapped = Number(value & 0xffffffffn);
    return isBlockedAddress(`${mapped >>> 24}.${(mapped >>> 16) & 255}.${(mapped >>> 8) & 255}.${mapped & 255}`);
  }
  const firstByte = Number(value >> 120n);
  return value === 0n
    || value === 1n
    || (firstByte & 0xfe) === 0xfc
    || (firstByte & 0xff) === 0xff
    || (firstByte & 0xff) === 0xfe && (Number(value >> 112n) & 0xc0) === 0x80;
};

const fileNameFrom = (url: string, override?: string) => {
  let candidate = override?.trim();
  if (!candidate) {
    const pathname = new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'anexo';
    try {
      candidate = decodeURIComponent(pathname);
    } catch {
      candidate = 'anexo';
    }
  }
  return candidate.replace(/[/\\]/g, '_').slice(0, 180) || 'anexo';
};

const validatedUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException('URL de anexo inválida.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Esquema de URL não permitido. Use http ou https.');
  }
  return url;
};

@Injectable()
export class AttachmentIntakeService {
  constructor(
    private readonly uploads: UploadService,
    @Optional() @Inject(ATTACHMENT_FETCH) private readonly fetchImpl: AttachmentFetch = ((url, init) => fetch(url, init)) as AttachmentFetch,
    private readonly lookup: DnsLookup = dns.lookup,
  ) {}

  async intakeByUrl(input: { tenantId: string; uploadedByTenantUserId: string; taskId?: string; projectId?: string; url: string; fileName?: string }) {
    let target = validatedUrl(input.url);

    for (let redirect = 0; ; redirect += 1) {
      const hostname = target.hostname.replace(/^\[|\]$/g, '');
      let addresses: Awaited<ReturnType<DnsLookup>>;
      try {
        addresses = await this.lookup(hostname, { all: true });
      } catch {
        throw new BadRequestException('Não foi possível baixar o anexo.');
      }
      if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
        throw new BadRequestException('Destino não permitido.');
      }

      let response: Awaited<ReturnType<AttachmentFetch>>;
      try {
        response = await this.fetchImpl(target.toString(), {
          redirect: 'manual',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new BadRequestException('Não foi possível baixar o anexo.');
      }

      if (response.status >= 300 && response.status < 400) {
        if (redirect >= MAX_REDIRECTS) throw new BadRequestException('Excesso de redirecionamentos ao baixar o arquivo.');
        const location = response.headers.get('location');
        if (!location) throw new BadRequestException('Redirecionamento sem destino.');
        let redirectUrl: string;
        try {
          redirectUrl = new URL(location, target).toString();
        } catch {
          throw new BadRequestException('Redirecionamento sem destino.');
        }
        target = validatedUrl(redirectUrl);
        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        throw new BadRequestException('Não foi possível baixar o anexo.');
      }

      const declared = Number(response.headers.get('content-length') ?? '0');
      if (!Number.isFinite(declared) || declared < 0 || declared > MAX_FILE_SIZE) {
        throw new BadRequestException('Arquivo acima do tamanho máximo de 100 MB.');
      }

      const mimeType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!(ALLOWED_MIMES as readonly string[]).includes(mimeType)) {
        throw new BadRequestException('Tipo de arquivo não permitido. Envie imagens, documentos ou planilhas.');
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(await response.arrayBuffer());
      } catch {
        throw new BadRequestException('Não foi possível baixar o anexo.');
      }
      if (buffer.byteLength > MAX_FILE_SIZE) throw new BadRequestException('Arquivo acima do tamanho máximo de 100 MB.');

      return this.uploads.uploadFile({
        tenantId: input.tenantId,
        uploadedByTenantUserId: input.uploadedByTenantUserId,
        taskId: input.taskId,
        projectId: input.projectId,
        fileName: fileNameFrom(target.toString(), input.fileName),
        mimeType,
        fileSize: buffer.byteLength,
        buffer,
      });
    }
  }
}
