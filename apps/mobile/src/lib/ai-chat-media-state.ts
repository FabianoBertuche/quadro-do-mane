interface AudioDownloadClient {
  get(path: string, config: { responseType: 'arraybuffer' }): Promise<{ data: ArrayBuffer }>;
}

export async function downloadAuthenticatedAudio(
  audioObjectKey: string,
  client: AudioDownloadClient,
  write: (data: ArrayBuffer) => Promise<string>,
): Promise<string> {
  const response = await client.get(`/ai/audio/${encodeURIComponent(audioObjectKey)}`, { responseType: 'arraybuffer' });
  return write(response.data);
}

export function createCachedAudioLifecycle(remove: (uri: string) => Promise<void>) {
  let mounted = true;
  let currentUri: string | null = null;

  return {
    resolve(uri: string, onReady: (uri: string) => void): boolean {
      if (!mounted) {
        void remove(uri);
        return false;
      }
      currentUri = uri;
      onReady(uri);
      return true;
    },
    async unmount(): Promise<void> {
      mounted = false;
      if (!currentUri) return;
      const uri = currentUri;
      currentUri = null;
      await remove(uri);
    },
  };
}
