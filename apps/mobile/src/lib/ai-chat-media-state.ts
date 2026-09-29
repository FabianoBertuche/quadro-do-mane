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
