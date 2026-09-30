import type { AiMessage } from '@/lib/ai-chat';

function messageText(message: AiMessage): { text: string; clarification: boolean } {
  if (!message.content) return { text: '', clarification: false };
  try {
    const value = JSON.parse(message.content) as { status?: string; result?: unknown };
    if (value.status === 'needsClarification') {
      return {
        text: typeof value.result === 'string' ? value.result : 'Preciso de mais informações para concluir esta ação.',
        clarification: true,
      };
    }
  } catch {
    // Messages from the provider are normally plain text.
  }
  return { text: message.content, clarification: false };
}

export function AiChatMessage({ message }: { message: AiMessage }) {
  const isUser = message.role === 'user';
  const { text, clarification } = messageText(message);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[min(42rem,90%)] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
          isUser ? 'bg-primary text-white rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
        }`}
      >
        {!isUser && clarification && <p className="mb-1 text-xs font-semibold text-primary">Esclarecimento necessário</p>}
        {text || 'Mensagem sem conteúdo'}
      </div>
    </div>
  );
}
