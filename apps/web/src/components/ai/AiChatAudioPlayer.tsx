'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function AiChatAudioPlayer({ audioObjectKey }: { audioObjectKey: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);
    api
      .get(`/ai/audio/${encodeURIComponent(audioObjectKey)}`, { responseType: 'blob' })
      .then(({ data }) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(data as Blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [audioObjectKey]);

  if (failed) return null;
  if (!url) return <span className="text-xs text-muted-foreground">Carregando áudio…</span>;
  return <audio controls preload="none" src={url} className="mt-2 h-8 w-56" aria-label="Ouvir resposta" />;
}
