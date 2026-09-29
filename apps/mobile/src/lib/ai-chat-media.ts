import { api } from './api';
import * as FileSystem from 'expo-file-system/legacy';
import { downloadAuthenticatedAudio } from './ai-chat-media-state';

export { downloadAuthenticatedAudio } from './ai-chat-media-state';

function toBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function downloadAudioToCache(audioObjectKey: string): Promise<string> {
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error('Cache de áudio indisponível');
  const fileUri = `${directory}ai-${Date.now()}.m4a`;
  return downloadAuthenticatedAudio(
    audioObjectKey,
    api,
    async (data) => {
      await FileSystem.writeAsStringAsync(fileUri, toBase64(data), { encoding: FileSystem.EncodingType.Base64 });
      return fileUri;
    },
  );
}

export async function deleteCachedAudio(fileUri: string): Promise<void> {
  await FileSystem.deleteAsync(fileUri, { idempotent: true });
}
