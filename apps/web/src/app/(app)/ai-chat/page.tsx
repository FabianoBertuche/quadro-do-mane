'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Mic, Plus, Send, Square, X } from 'lucide-react';
import { AiActionProposalCard } from '@/components/ai/AiActionProposalCard';
import { AiChatAudioPlayer } from '@/components/ai/AiChatAudioPlayer';
import { AiChatMessage } from '@/components/ai/AiChatMessage';
import {
  cancelAction,
  confirmAction,
  createConversation,
  listConversations,
  listMessages,
  sendAudioMessage,
  sendTextMessage,
  mergeAiMessageResponse,
  createOptimisticAiMessage,
  type AiMessage,
  type AiResponseMode,
} from '@/lib/ai-chat';
import { useAuthStore } from '@/lib/auth';

/** Modos de resposta por conversa, como no app: Texto ou Voz (TTS). */
const responseModesByConversation = new Map<string, AiResponseMode>();

const audioFilename = (mimeType: string): string => {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'comando.m4a';
  if (mimeType.includes('ogg')) return 'comando.ogg';
  if (mimeType.includes('wav')) return 'comando.wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'comando.mp3';
  return 'comando.webm';
};

export default function AiChatPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const contextProjectId = searchParams?.get('contextProjectId') || undefined;
  const hydrated = useAuthStore((state) => state.hydrated);
  const [conversationId, setConversationId] = useState<string>();
  const [text, setText] = useState('');
  const [responseMode, setResponseMode] = useState<AiResponseMode>('TEXT');
  const [recording, setRecording] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [optimisticMessage, setOptimisticMessage] = useState<AiMessage | null>(null);
  const messagesPanelRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingSupported = typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia;

  const conversations = useInfiniteQuery({
    queryKey: ['ai-conversations'],
    queryFn: ({ pageParam }) => listConversations(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => lastPage.length === 20 ? pages.length + 1 : undefined,
    enabled: hydrated,
  });

  const availableConversations = conversations.data?.pages.flat() || [];

  const conversation = useQuery({
    queryKey: ['ai-conversation', contextProjectId || 'global'],
    queryFn: async () => {
      const available = availableConversations;
      const selected = contextProjectId
        ? available.find((item) => item.contextProjectId === contextProjectId)
        : available.find((item) => !item.contextProjectId);
      return selected || createConversation(contextProjectId);
    },
    enabled: hydrated && !conversations.isLoading && !conversations.isError,
  });

  useEffect(() => {
    if (conversation.data?.id) {
      setConversationId(conversation.data.id);
      setResponseMode(responseModesByConversation.get(conversation.data.id) ?? 'TEXT');
    }
  }, [conversation.data?.id]);

  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const messages = useQuery({
    queryKey: ['ai-messages', conversationId],
    queryFn: () => listMessages(conversationId as string),
    enabled: !!conversationId,
  });

  const refreshAfterAction = async () => {
    await queryClient.invalidateQueries({ queryKey: ['ai-messages', conversationId] });
    await queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    if (contextProjectId) {
      await queryClient.invalidateQueries({ queryKey: ['project', contextProjectId] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  };

  const applyResponse = async (response: Awaited<ReturnType<typeof sendTextMessage>>) => {
    queryClient.setQueryData(['ai-messages', conversationId], (current: Awaited<ReturnType<typeof listMessages>> | undefined) =>
      current ? mergeAiMessageResponse(current, response) : current,
    );
    await refreshAfterAction();
  };

  const send = useMutation({
    mutationFn: (value: string) => sendTextMessage({ conversationId: conversationId as string, text: value, responseMode }),
    onSuccess: async (response) => {
      setText('');
      await applyResponse(response);
      setOptimisticMessage(null);
    },
    onError: () => setOptimisticMessage((message) => message ? { ...message, localStatus: 'failed' } : message),
  });

  const sendAudio = useMutation({
    mutationFn: (input: { audio: Blob; filename: string }) =>
      sendAudioMessage({ conversationId: conversationId as string, ...input, responseMode }),
    onSuccess: async (response) => {
      await applyResponse(response);
    },
    onError: () => setAudioError('Não foi possível enviar o áudio. Tente novamente.'),
  });

  const busy = send.isPending || sendAudio.isPending;

  useEffect(() => {
    const panel = messagesPanelRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [messages.data?.messages.length, optimisticMessage?.id, send.isPending, sendAudio.isPending]);

  const action = useMutation<Awaited<ReturnType<typeof confirmAction>> | void, Error, { id: string; confirm: boolean }>({
    mutationFn: ({ id, confirm }: { id: string; confirm: boolean }) => (confirm ? confirmAction(id) : cancelAction(id)),
    onSuccess: () => { void refreshAfterAction(); },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (value && conversationId && !busy) {
      setOptimisticMessage(createOptimisticAiMessage(value, `optimistic-${Date.now()}`));
      send.mutate(value);
    }
  };

  const selectResponseMode = (mode: AiResponseMode) => {
    if (conversationId) responseModesByConversation.set(conversationId, mode);
    setResponseMode(mode);
  };

  const startRecording = async () => {
    if (!conversationId || recording || busy) return;
    setAudioError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
      setAudioError('Não foi possível acessar o microfone. Verifique a permissão do navegador.');
    }
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const cancelRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => stopTracks();
      recorder.stop();
    } else {
      stopTracks();
    }
    chunksRef.current = [];
    recorderRef.current = null;
    setRecording(false);
  };

  const stopAndSendRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      cancelRecording();
      return;
    }
    recorder.onstop = () => {
      stopTracks();
      const type = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      recorderRef.current = null;
      setRecording(false);
      if (blob.size) sendAudio.mutate({ audio: blob, filename: audioFilename(type) });
    };
    recorder.stop();
  };

  const newConversation = useMutation({
    mutationFn: () => createConversation(contextProjectId),
    onSuccess: (created) => {
      setConversationId(created.id);
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
  });

  if (conversations.isLoading || conversation.isLoading) return <div className="animate-pulse h-96 rounded-2xl bg-muted" />;
  if (conversations.isError || conversation.isError) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Não foi possível carregar o assistente.</div>;

  const page = messages.data;
  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-5xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary"><Bot className="h-6 w-6" /></div>
          <div><h1 className="text-2xl font-bold">Assistente IA</h1><p className="text-sm text-muted-foreground">Pergunte, organize e execute ações com confirmação.</p></div>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Modo de resposta" className="flex rounded-xl border border-border p-0.5 text-xs">
            {(['TEXT', 'AUDIO'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => selectResponseMode(mode)}
                aria-pressed={responseMode === mode}
                className={`rounded-lg px-2.5 py-1.5 font-medium ${responseMode === mode ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {mode === 'TEXT' ? 'Texto' : 'Voz'}
              </button>
            ))}
          </div>
          <select value={conversationId || ''} onChange={(event) => { setConversationId(event.target.value); setResponseMode(responseModesByConversation.get(event.target.value) ?? 'TEXT'); }} className="max-w-[18rem] rounded-xl border border-border bg-card px-3 py-2 text-sm" aria-label="Selecionar conversa">
            {availableConversations.filter((item) => contextProjectId ? item.contextProjectId === contextProjectId : !item.contextProjectId).map((item) => <option key={item.id} value={item.id}>{item.contextProjectId ? `Projeto ${item.contextProjectId.slice(0, 8)}` : 'Conversa global'}</option>)}
          </select>
          <button type="button" onClick={() => newConversation.mutate()} disabled={newConversation.isPending} className="rounded-xl border border-border p-2 hover:bg-muted disabled:opacity-50" aria-label="Nova conversa"><Plus className="h-4 w-4" /></button>
          {conversations.hasNextPage && <button type="button" onClick={() => conversations.fetchNextPage()} disabled={conversations.isFetchingNextPage} className="rounded-xl border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50">{conversations.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}</button>}
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card">
        <div ref={messagesPanelRef} className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {messages.isLoading && <p className="text-sm text-muted-foreground">Carregando mensagens...</p>}
          {messages.isError && <p className="text-sm text-red-600">Não foi possível carregar as mensagens.</p>}
          {!messages.isLoading && !messages.isError && !page?.messages.length && <p className="py-16 text-center text-sm text-muted-foreground">Comece uma conversa com a assistente.</p>}
          {page?.messages.map((message) => (
            <div key={message.id}>
              <AiChatMessage message={message} />
              {message.role === 'assistant' && message.audioObjectKey && (
                <div className="mt-1 flex justify-start pl-1">
                  <AiChatAudioPlayer audioObjectKey={message.audioObjectKey} />
                </div>
              )}
            </div>
          ))}
          {optimisticMessage && <AiChatMessage message={optimisticMessage} />}
          {(send.isPending || sendAudio.isPending) && (
            <div className="flex justify-start" role="status" aria-live="polite">
              <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm text-muted-foreground">
                <span className="mr-2 inline-flex gap-1 align-middle" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                </span>
                Pensando e executando sua solicitação...
              </div>
            </div>
          )}
          {page?.pendingProposals.map((proposal) => <AiActionProposalCard key={proposal.id} proposal={proposal} busy={action.isPending} onConfirm={() => action.mutate({ id: proposal.id, confirm: true })} onCancel={() => action.mutate({ id: proposal.id, confirm: false })} />)}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-3">
          {recording ? (
            <>
              <span className="flex min-h-12 flex-1 items-center gap-2 px-1 text-sm text-red-600" role="status" aria-live="polite">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
                Gravando… clique em parar para enviar.
              </span>
              <button type="button" onClick={cancelRecording} className="rounded-xl border border-border p-3 hover:bg-muted" aria-label="Cancelar gravação"><X className="h-4 w-4" /></button>
              <button type="button" onClick={stopAndSendRecording} className="rounded-xl bg-primary p-3 text-white" aria-label="Parar e enviar áudio"><Square className="h-4 w-4" /></button>
            </>
          ) : (
            <>
              <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Escreva uma pergunta ou comando..." rows={2} className="min-h-12 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" disabled={busy} />
              {text.trim()
                ? <button type="submit" disabled={!conversationId || busy} className="rounded-xl bg-primary p-3 text-white disabled:opacity-50" aria-label="Enviar mensagem"><Send className="h-4 w-4" /></button>
                : recordingSupported && (
                  <button type="button" onClick={startRecording} disabled={!conversationId || busy} className="rounded-xl bg-primary p-3 text-white disabled:opacity-50" aria-label="Gravar comando de voz"><Mic className="h-4 w-4" /></button>
                )}
            </>
          )}
        </form>
        {send.isError && <p className="px-4 pb-3 text-sm text-red-600">Não foi possível enviar a mensagem. Tente novamente.</p>}
        {(sendAudio.isError || audioError) && <p className="px-4 pb-3 text-sm text-red-600">{audioError ?? 'Não foi possível enviar o áudio. Tente novamente.'}</p>}
        {action.isError && <p className="px-4 pb-3 text-sm text-red-600">Não foi possível atualizar a proposta.</p>}
        {newConversation.isError && <p className="px-4 pb-3 text-sm text-red-600">Não foi possível criar uma nova conversa. Tente novamente.</p>}
      </section>
    </div>
  );
}
