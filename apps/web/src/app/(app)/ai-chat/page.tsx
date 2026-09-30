'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Plus, Send } from 'lucide-react';
import { AiActionProposalCard } from '@/components/ai/AiActionProposalCard';
import { AiChatMessage } from '@/components/ai/AiChatMessage';
import {
  cancelAction,
  confirmAction,
  createConversation,
  listConversations,
  listMessages,
  sendTextMessage,
} from '@/lib/ai-chat';
import { useAuthStore } from '@/lib/auth';

export default function AiChatPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const contextProjectId = searchParams?.get('contextProjectId') || undefined;
  const hydrated = useAuthStore((state) => state.hydrated);
  const [conversationId, setConversationId] = useState<string>();
  const [text, setText] = useState('');

  const conversations = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: listConversations,
    enabled: hydrated,
  });

  const conversation = useQuery({
    queryKey: ['ai-conversation', contextProjectId || 'global'],
    queryFn: async () => {
      const available = conversations.data || [];
      const selected = contextProjectId
        ? available.find((item) => item.contextProjectId === contextProjectId)
        : available.find((item) => !item.contextProjectId);
      return selected || createConversation(contextProjectId);
    },
    enabled: hydrated && !conversations.isLoading && !conversations.isError,
  });

  useEffect(() => {
    if (conversation.data?.id) setConversationId(conversation.data.id);
  }, [conversation.data?.id]);

  const messages = useQuery({
    queryKey: ['ai-messages', conversationId],
    queryFn: () => listMessages(conversationId as string),
    enabled: !!conversationId,
  });

  const refreshAfterAction = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-messages', conversationId] });
    queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    if (contextProjectId) {
      queryClient.invalidateQueries({ queryKey: ['project', contextProjectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  };

  const send = useMutation({
    mutationFn: (value: string) => sendTextMessage({ conversationId: conversationId as string, text: value, responseMode: 'TEXT' }),
    onSuccess: () => {
      setText('');
      refreshAfterAction();
    },
  });

  const action = useMutation<Awaited<ReturnType<typeof confirmAction>> | void, Error, { id: string; confirm: boolean }>({
    mutationFn: ({ id, confirm }: { id: string; confirm: boolean }) => (confirm ? confirmAction(id) : cancelAction(id)),
    onSuccess: refreshAfterAction,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (value && conversationId && !send.isPending) send.mutate(value);
  };

  const startNewConversation = async () => {
    const created = await createConversation(contextProjectId);
    setConversationId(created.id);
    queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
  };

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
          <select value={conversationId || ''} onChange={(event) => setConversationId(event.target.value)} className="max-w-[18rem] rounded-xl border border-border bg-card px-3 py-2 text-sm" aria-label="Selecionar conversa">
            {(conversations.data || []).filter((item) => contextProjectId ? item.contextProjectId === contextProjectId : !item.contextProjectId).map((item) => <option key={item.id} value={item.id}>{item.contextProjectId ? `Projeto ${item.contextProjectId.slice(0, 8)}` : 'Conversa global'}</option>)}
          </select>
          <button type="button" onClick={startNewConversation} className="rounded-xl border border-border p-2 hover:bg-muted" aria-label="Nova conversa"><Plus className="h-4 w-4" /></button>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {messages.isLoading && <p className="text-sm text-muted-foreground">Carregando mensagens...</p>}
          {messages.isError && <p className="text-sm text-red-600">Não foi possível carregar as mensagens.</p>}
          {!messages.isLoading && !messages.isError && !page?.messages.length && <p className="py-16 text-center text-sm text-muted-foreground">Comece uma conversa com a assistente.</p>}
          {page?.messages.map((message) => <AiChatMessage key={message.id} message={message} />)}
          {page?.pendingProposals.map((proposal) => <AiActionProposalCard key={proposal.id} proposal={proposal} busy={action.isPending} onConfirm={() => action.mutate({ id: proposal.id, confirm: true })} onCancel={() => action.mutate({ id: proposal.id, confirm: false })} />)}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-3">
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Escreva uma pergunta ou comando..." rows={2} className="min-h-12 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" disabled={send.isPending} />
          <button type="submit" disabled={!text.trim() || send.isPending || !conversationId} className="rounded-xl bg-primary p-3 text-white disabled:opacity-50" aria-label="Enviar mensagem"><Send className="h-4 w-4" /></button>
        </form>
        {send.isError && <p className="px-4 pb-3 text-sm text-red-600">Não foi possível enviar a mensagem. Tente novamente.</p>}
        {action.isError && <p className="px-4 pb-3 text-sm text-red-600">Não foi possível atualizar a proposta.</p>}
      </section>
    </div>
  );
}
