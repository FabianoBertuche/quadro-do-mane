import type { AiMessage } from '@/lib/ai-chat';
import { getClarificationDetails } from '@/lib/ai-chat';

export function AiChatMessage({ message }: { message: AiMessage }) {
  const isUser = message.role === 'user';
  const clarification = message.content ? getClarificationDetails(message.content) : null;
  const text = clarification?.message || message.content || '';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[min(42rem,90%)] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
          isUser ? 'bg-primary text-white rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
        }`}
      >
        {!isUser && clarification && (
          <div className="mb-2 space-y-1 text-sm">
            <p className="font-semibold text-primary">Esclarecimento necessário</p>
            {clarification.field && <p><span className="font-medium">Campo:</span> {clarification.field}</p>}
            {clarification.options.length > 0 && (
              <ul className="list-disc pl-5">
                 {clarification.options.map((option) => <li key={option.id}>{option.name}</li>)}
              </ul>
            )}
          </div>
        )}
        {text || 'Mensagem sem conteúdo'}
        {isUser && message.localStatus === 'sending' && <span className="mt-1 block text-xs text-white/70">Enviando...</span>}
        {isUser && message.localStatus === 'failed' && <span className="mt-1 block text-xs text-red-100">Falha ao enviar. Tente novamente.</span>}
      </div>
    </div>
  );
}
