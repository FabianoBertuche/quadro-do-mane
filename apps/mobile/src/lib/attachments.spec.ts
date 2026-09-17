import { describe, expect, it } from 'vitest';
import {
  MAX_FILE_SIZE_BYTES,
  attachmentFileUrl,
  buildUploadableFile,
  canDeleteAttachment,
  formatFileSize,
  validateAttachmentSize,
  type PickedAttachment,
} from './attachments';

describe('validateAttachmentSize', () => {
  it('aceita tamanho indefinido (picker não informa size)', () => {
    expect(validateAttachmentSize(undefined)).toBeNull();
    expect(validateAttachmentSize(null)).toBeNull();
  });

  it('aceita arquivo exatamente no limite de 100 MB', () => {
    expect(validateAttachmentSize(MAX_FILE_SIZE_BYTES)).toBeNull();
  });

  it('aceita arquivo abaixo do limite de 100 MB', () => {
    expect(validateAttachmentSize(1000)).toBeNull();
  });

  it('rejeita arquivo acima de 100 MB com mensagem de tamanho', () => {
    const msg = validateAttachmentSize(MAX_FILE_SIZE_BYTES + 1);
    expect(msg).not.toBeNull();
    expect(msg).toContain('100 MB');
  });
});

describe('canDeleteAttachment', () => {
  const attachment = { uploadedByTenantUserId: 'tu-1' };

  it('admin exclui anexo de qualquer pessoa', () => {
    expect(
      canDeleteAttachment({ role: 'admin', permissions: [], tenantUserId: 'tu-2' }, attachment),
    ).toBe(true);
  });

  it('usuário com permissão tasks.delete exclui qualquer anexo', () => {
    expect(
      canDeleteAttachment(
        { role: 'manager', permissions: ['tasks.delete'], tenantUserId: 'tu-2' },
        attachment,
      ),
    ).toBe(true);
  });

  it('quem enviou o anexo pode excluir', () => {
    expect(
      canDeleteAttachment({ role: 'member', permissions: [], tenantUserId: 'tu-1' }, attachment),
    ).toBe(true);
  });

  it('outro usuário sem permissão não exclui', () => {
    expect(
      canDeleteAttachment({ role: 'member', permissions: [], tenantUserId: 'tu-2' }, attachment),
    ).toBe(false);
  });

  it('lida com perfil sem role/permissions/tenantUserId', () => {
    expect(canDeleteAttachment({}, attachment)).toBe(false);
    expect(canDeleteAttachment({ role: 'admin' }, attachment)).toBe(true);
    expect(canDeleteAttachment({ permissions: ['tasks.delete'] }, attachment)).toBe(true);
  });
});

describe('buildUploadableFile', () => {
  it('monta arquivo com type padrão quando não informado', () => {
    expect(buildUploadableFile({ uri: 'file:///a.pdf', name: 'a.pdf' })).toEqual({
      uri: 'file:///a.pdf',
      name: 'a.pdf',
      type: 'application/octet-stream',
    });
  });

  it('preserva o type informado', () => {
    const asset: PickedAttachment = { uri: 'file:///f.png', name: 'f.png', type: 'image/png' };
    expect(buildUploadableFile(asset)).toEqual({
      uri: 'file:///f.png',
      name: 'f.png',
      type: 'image/png',
    });
  });

  it('retorna null quando falta uri ou name', () => {
    expect(buildUploadableFile({ uri: '', name: 'x.pdf' })).toBeNull();
    expect(buildUploadableFile({ uri: 'file:///x.pdf', name: '' })).toBeNull();
  });
});

describe('attachmentFileUrl', () => {
  it('monta URL completa do upload com base sem barra final', () => {
    expect(attachmentFileUrl('http://10.0.0.2:3001/api', 'uploads/t1/a.png')).toBe(
      'http://10.0.0.2:3001/api/uploads/t1/a.png',
    );
  });

  it('monta URL completa do upload com base com barra final', () => {
    expect(attachmentFileUrl('http://10.0.0.2:3001/api/', '/uploads/t1/a.png')).toBe(
      'http://10.0.0.2:3001/api/uploads/t1/a.png',
    );
  });
});

describe('formatFileSize', () => {
  it('formata bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formata KB com uma casa decimal', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('formata MB com uma casa decimal', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});