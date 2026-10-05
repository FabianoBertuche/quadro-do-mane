import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { AttachmentIntakeService, DnsLookup, isBlockedAddress } from './attachment-intake.service';
import { MAX_FILE_SIZE } from './upload.constants';

const uploads = { uploadFile: async (params: any) => ({ id: 'att-1', ...params }) } as any;

const respond = (body: string | Buffer | Buffer[], headers: Record<string, string> = {}, status = 200) => {
  const stream = Readable.from(Array.isArray(body) ? body : [body]);
  let destroyed = false;
  return {
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    body: stream,
    destroy: () => {
      destroyed = true;
      stream.destroy();
    },
    get destroyed() { return destroyed; },
  };
};

const publicDns: DnsLookup = async () => [{ address: '8.8.8.8', family: 4 }];
const serviceWith = (fetchImpl: any, lookup: DnsLookup = publicDns) => new AttachmentIntakeService(uploads, fetchImpl, lookup);

const input = {
  tenantId: 'tenant-1',
  uploadedByTenantUserId: 'user-1',
  taskId: 'task-1',
  url: 'https://files.exemplo.com/relatorio.txt',
};

test('recusa endereços de loopback, rede privada e link-local', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '192.168.1.5', '172.16.0.1', '169.254.169.254', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::127.0.0.1']) {
    assert.equal(isBlockedAddress(address), true, address);
  }
});

test('aceita endereços públicos', () => {
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700::1111']) {
    assert.equal(isBlockedAddress(address), false, address);
  }
});

test('baixa a URL pública e registra o anexo', async () => {
  let captured: any;
  let approvedAddress: string | undefined;
  const service = serviceWith(async (url: string, init: any) => {
    captured = url;
    approvedAddress = init.address;
    return respond('conteúdo', { 'content-type': 'text/plain' });
  });
  const saved = await service.intakeByUrl(input);
  assert.equal(captured, input.url);
  assert.equal(approvedAddress, '8.8.8.8');
  assert.equal(saved.fileName, 'relatorio.txt');
  assert.equal(saved.mimeType, 'text/plain');
});

test('recusa esquema que não seja http ou https', async () => {
  const service = serviceWith(async () => respond('x'));
  await assert.rejects(() => service.intakeByUrl({ ...input, url: 'file:///etc/passwd' }), /não permitido/i);
});

test('recusa arquivo acima de 100 MB', async () => {
  const response = respond('x', { 'content-length': String(MAX_FILE_SIZE + 1), 'content-type': 'text/plain' });
  const service = serviceWith(async () => response);
  await assert.rejects(() => service.intakeByUrl(input), /tamanho/i);
  assert.equal(response.destroyed, true);
});

test('recusa MIME fora da lista', async () => {
  const service = serviceWith(async () => respond('x', { 'content-type': 'application/x-msdownload' }));
  await assert.rejects(() => service.intakeByUrl(input), /tipo de arquivo/i);
});

test('segue no máximo dois redirecionamentos e revalida o destino', async () => {
  let chamadas = 0;
  const service = serviceWith(async () => {
    chamadas += 1;
    return {
      status: 302,
      headers: { get: (name: string) => (name.toLowerCase() === 'location' ? 'https://outro.exemplo.com/a.txt' : null) },
      body: Readable.from([]),
      destroy: () => undefined,
    };
  });
  await assert.rejects(() => service.intakeByUrl(input), /redirecionamento/i);
  assert.equal(chamadas, 3);
});

test('texto com acento em nome de arquivo é preservado', async () => {
  const service = serviceWith(async () => respond('x', { 'content-type': 'text/plain' }));
  const saved = await service.intakeByUrl({ ...input, url: 'https://files.exemplo.com/relat%C3%B3rio%20anual.txt' });
  assert.equal(saved.fileName, 'relatório anual.txt');
});

test('não faz request quando DNS aponta para endereço bloqueado', async () => {
  let fetched = false;
  const service = serviceWith(async () => {
    fetched = true;
    return respond('x', { 'content-type': 'text/plain' });
  }, async () => [{ address: '127.0.0.1', family: 4 }]);
  await assert.rejects(() => service.intakeByUrl(input), /destino não permitido/i);
  assert.equal(fetched, false);
});

test('valida IPv6 literal sem colchetes antes do request', async () => {
  let fetched = false;
  const service = serviceWith(async () => {
    fetched = true;
    return respond('x', { 'content-type': 'text/plain' });
  }, async (hostname) => hostname === '::1'
    ? [{ address: '::1', family: 6 }]
    : [{ address: '8.8.8.8', family: 4 }]);
  await assert.rejects(() => service.intakeByUrl({ ...input, url: 'http://[::1]/anexo.txt' }), /destino não permitido/i);
  assert.equal(fetched, false);
});

test('não expõe o destino quando a resolução DNS falha', async () => {
  const service = serviceWith(async () => respond('x'), async () => {
    throw new Error('getaddrinfo ENOTFOUND segredo.exemplo.com');
  });
  await assert.rejects(() => service.intakeByUrl(input), /não foi possível baixar o anexo/i);
});

test('recusa URL com credenciais', async () => {
  const service = serviceWith(async () => respond('x', { 'content-type': 'text/plain' }));
  await assert.rejects(() => service.intakeByUrl({ ...input, url: 'https://user:secret@files.exemplo.com/a.txt' }), /não permitido/i);
});

test('recusa URL com porta não padrão', async () => {
  const service = serviceWith(async () => respond('x', { 'content-type': 'text/plain' }));
  await assert.rejects(() => service.intakeByUrl({ ...input, url: 'https://files.exemplo.com:8443/a.txt' }), /não permitido/i);
});

test('recusa redirect para DNS privado antes de conectar', async () => {
  let calls = 0;
  const first = respond('', { location: 'https://interno.exemplo.com/a.txt' }, 302);
  const service = serviceWith(async () => {
    calls += 1;
    return first;
  }, async (hostname) => hostname === 'interno.exemplo.com'
    ? [{ address: '10.0.0.1', family: 4 }]
    : [{ address: '8.8.8.8', family: 4 }]);
  await assert.rejects(() => service.intakeByUrl(input), /destino não permitido/i);
  assert.equal(calls, 1);
  assert.equal(first.destroyed, true);
});

test('encerra resposta em redirect sem Location', async () => {
  const response = respond('', {}, 302);
  const service = serviceWith(async () => response);
  await assert.rejects(() => service.intakeByUrl(input), /redirecionamento sem destino/i);
  assert.equal(response.destroyed, true);
});

test('cancela stream quando o corpo excede 100 MB sem Content-Length', async () => {
  const response = respond([Buffer.alloc(MAX_FILE_SIZE), Buffer.alloc(1)], { 'content-type': 'text/plain' });
  const service = serviceWith(async () => response);
  await assert.rejects(() => service.intakeByUrl(input), /tamanho/i);
  assert.equal(response.destroyed, true);
});

test('sanitiza nome de arquivo e aplica fallback após a limpeza', async () => {
  const service = serviceWith(async () => respond('x', { 'content-type': 'text/plain' }));
  const saved = await service.intakeByUrl({ ...input, fileName: '\u0000<>:"|?*' });
  assert.equal(saved.fileName, 'anexo');
});
