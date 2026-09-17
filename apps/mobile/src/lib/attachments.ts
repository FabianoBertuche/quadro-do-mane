/**
 * Lógica pura de anexos (paridade com a web).
 *
 * Sem imports de React Native — testável em Node (vitest) e usável no app.
 */

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

export interface PickedAttachment {
  uri: string;
  name: string;
  type?: string | null;
  size?: number | null;
}

export interface UploadableFile {
  uri: string;
  name: string;
  type: string;
}

export interface DeletePermission {
  role?: string | null;
  permissions?: string[];
  tenantUserId?: string | null;
}

export interface AttachmentRef {
  uploadedByTenantUserId?: string | null;
}

/** Valida o tamanho do arquivo. Retorna mensagem de erro ou null se ok. */
export function validateAttachmentSize(size?: number | null): string | null {
  if (size == null || size <= 0) return null;
  if (size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (size / (1024 * 1024)).toFixed(1);
    return `O arquivo tem ${sizeMB} MB e excede o limite máximo de 100 MB.`;
  }
  return null;
}

/** Mesma regra da web: admin (ou quem tem tasks.delete) ou quem enviou o anexo. */
export function canDeleteAttachment(
  user: DeletePermission,
  attachment: AttachmentRef,
): boolean {
  const isAdmin =
    user.role === 'admin' || (user.permissions ?? []).includes('tasks.delete');
  return (
    isAdmin ||
    (!!attachment.uploadedByTenantUserId &&
      attachment.uploadedByTenantUserId === user.tenantUserId)
  );
}

/** Converte o asset do picker no objeto aceito pelo FormData do React Native. */
export function buildUploadableFile(asset: PickedAttachment): UploadableFile | null {
  if (!asset.uri || !asset.name) return null;
  return {
    uri: asset.uri,
    name: asset.name,
    type: asset.type || 'application/octet-stream',
  };
}

/** URL pública do arquivo servido pelo backend (filePath = "uploads/..."). */
export function attachmentFileUrl(baseUrl: string, filePath?: string | null): string {
  if (!filePath) return '';
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/${filePath.replace(/^\/+/, '')}`;
}

/** Formata tamanho em B/KB/MB (mesma regra da web). */
export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}