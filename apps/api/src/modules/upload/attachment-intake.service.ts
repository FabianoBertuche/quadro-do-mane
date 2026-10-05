import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import * as dns from 'node:dns/promises';
import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import { UploadService } from './upload.service';
import { ALLOWED_MIMES, MAX_FILE_SIZE } from './upload.constants';

export const ATTACHMENT_FETCH = Symbol('ATTACHMENT_FETCH');
export const ATTACHMENT_DNS_LOOKUP = Symbol('ATTACHMENT_DNS_LOOKUP');
export const MAX_REDIRECTS = 2;
const REQUEST_TIMEOUT_MS = 10_000;

export type AttachmentResponse = { status: number; headers: { get(name: string): string | null }; body: AsyncIterable<Uint8Array>; destroy(): void };
export type AttachmentFetch = (url: string, init: { address: string; redirect: 'manual'; signal?: AbortSignal }) => Promise<AttachmentResponse>;
export type DnsLookup = (hostname: string, options: { all: true }) => Promise<Array<{ address: string; family: number }>>;

const defaultAttachmentFetch: AttachmentFetch = (url, init) => new Promise((resolve, reject) => {
  const target = new URL(url);
  const hostname = target.hostname.replace(/^\[|\]$/g, '');
  const client = target.protocol === 'https:' ? https : http;
  const request = client.request({ protocol: target.protocol, hostname, port: target.port || undefined, path: `${target.pathname}${target.search}`, method: 'GET', headers: { host: target.host }, servername: hostname,
    lookup: ((_host: string, _options: unknown, callback: (error: Error | null, address?: string, family?: number) => void) => callback(null, init.address, net.isIPv6(init.address) ? 6 : 4)) as any,
  }, (response) => resolve({ status: response.statusCode ?? 0, headers: { get: (name) => { const value = response.headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] ?? null : value ?? null; } }, body: response, destroy: () => response.destroy() }));
  const abort = () => request.destroy(new Error('Request timed out'));
  if (init.signal?.aborted) abort(); else init.signal?.addEventListener('abort', abort, { once: true });
  request.setTimeout(REQUEST_TIMEOUT_MS, abort);
  request.once('error', reject);
  request.end();
});

const ipv4Value = (address: string) => address.split('.').reduce((value, part) => (value << 8) + Number(part), 0);
const ipv6Value = (address: string): bigint => {
  const normalized = address.toLowerCase().replace(/(\d+\.\d+\.\d+\.\d+)$/, (ipv4) => { const value = ipv4Value(ipv4); return `${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`; });
  const [head, tail = ''] = normalized.split('::'); const before = head ? head.split(':') : []; const after = tail ? tail.split(':') : [];
  return [...before, ...Array(Math.max(8 - before.length - after.length, 0)).fill('0'), ...after].reduce((value, part) => (value << 16n) + BigInt(`0x${part || '0'}`), 0n);
};
export const isBlockedAddress = (address: string): boolean => {
  if (net.isIPv4(address)) { const value = ipv4Value(address); return value >>> 24 === 0 || value >>> 24 === 10 || value >>> 24 === 127 || value >>> 16 === 0xa9fe || value >>> 20 === 0xac1 || value >>> 16 === 0xc0a8 || value >>> 22 === 0x191 || value >>> 28 >= 14; }
  if (!net.isIPv6(address)) return true;
  const value = ipv6Value(address); const prefix = value >> 32n;
  if (prefix === 0xffffn || prefix === 0n) { const mapped = Number(value & 0xffffffffn); return isBlockedAddress(`${mapped >>> 24}.${(mapped >>> 16) & 255}.${(mapped >>> 8) & 255}.${mapped & 255}`); }
  const first = Number(value >> 120n); return value === 0n || value === 1n || (first & 0xfe) === 0xfc || first === 0xff || first === 0xfe && (Number(value >> 112n) & 0xc0) === 0x80;
};
const fileNameFrom = (url: string, override?: string) => {
  let candidate = override?.trim();
  if (!candidate) {
    try {
      candidate = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'anexo');
    } catch {
      candidate = 'anexo';
    }
  }
  // Replace disallowed characters with underscore
  let sanitized = candidate.replace(/[\\/\0-\x1f<>:"|?*]/g, '_').trim().slice(0, 180);
  // If sanitized is empty or consists only of underscores, fallback to generic name
  if (!sanitized || /^_+$/.test(sanitized)) {
    sanitized = 'anexo';
  }
  return sanitized;
};
const validatedUrl = (value: string) => {
  let url: URL; try { url = new URL(value); } catch { throw new BadRequestException('URL de anexo inválida.'); }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password || url.port) throw new BadRequestException('URL de anexo não permitido.');
  return url;
};
const readBody = async (response: AttachmentResponse) => {
  const chunks: Buffer[] = []; let size = 0;
  try { for await (const chunk of response.body) { const buffer = Buffer.from(chunk); size += buffer.byteLength; if (size > MAX_FILE_SIZE) { response.destroy(); throw new BadRequestException('Arquivo acima do tamanho máximo de 100 MB.'); } chunks.push(buffer); } } catch (error) { response.destroy(); throw error; }
  return Buffer.concat(chunks, size);
};

@Injectable()
export class AttachmentIntakeService {
  constructor(private readonly uploads: UploadService, @Optional() @Inject(ATTACHMENT_FETCH) private readonly fetchImpl: AttachmentFetch = defaultAttachmentFetch, @Optional() @Inject(ATTACHMENT_DNS_LOOKUP) private readonly lookup: DnsLookup = dns.lookup) {}
  async intakeByUrl(input: { tenantId: string; uploadedByTenantUserId: string; taskId?: string; projectId?: string; url: string; fileName?: string }) {
    let target = validatedUrl(input.url);
    for (let redirect = 0; ; redirect += 1) {
      const hostname = target.hostname.replace(/^\[|\]$/g, ''); let addresses: Awaited<ReturnType<DnsLookup>>;
      try { addresses = await this.lookup(hostname, { all: true }); } catch { throw new BadRequestException('Não foi possível baixar o anexo.'); }
      if (!addresses.length || addresses.some((entry) => isBlockedAddress(entry.address))) throw new BadRequestException('Destino não permitido.');
      let response: AttachmentResponse;
      try { response = await this.fetchImpl(target.toString(), { address: addresses[0].address, redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }); } catch { throw new BadRequestException('Não foi possível baixar o anexo.'); }
      if (response.status >= 300 && response.status < 400) { response.destroy(); if (redirect >= MAX_REDIRECTS) throw new BadRequestException('Excesso de redirecionamentos ao baixar o arquivo.'); const location = response.headers.get('location'); if (!location) throw new BadRequestException('Redirecionamento sem destino.'); let next: string; try { next = new URL(location, target).toString(); } catch { throw new BadRequestException('Redirecionamento sem destino.'); } target = validatedUrl(next); continue; }
      if (response.status < 200 || response.status >= 300) { response.destroy(); throw new BadRequestException('Não foi possível baixar o anexo.'); }
      const declared = Number(response.headers.get('content-length')); if (Number.isFinite(declared) && declared > MAX_FILE_SIZE) { response.destroy(); throw new BadRequestException('Arquivo acima do tamanho máximo de 100 MB.'); }
      const mimeType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase(); if (!(ALLOWED_MIMES as readonly string[]).includes(mimeType)) { response.destroy(); throw new BadRequestException('Tipo de arquivo não permitido. Envie imagens, documentos ou planilhas.'); }
      let buffer: Buffer; try { buffer = await readBody(response); } catch (error) { if (error instanceof BadRequestException) throw error; throw new BadRequestException('Não foi possível baixar o anexo.'); }
      return this.uploads.uploadFile({ tenantId: input.tenantId, uploadedByTenantUserId: input.uploadedByTenantUserId, taskId: input.taskId, projectId: input.projectId, fileName: fileNameFrom(target.toString(), input.fileName), mimeType, fileSize: buffer.byteLength, buffer });
    }
  }
}
