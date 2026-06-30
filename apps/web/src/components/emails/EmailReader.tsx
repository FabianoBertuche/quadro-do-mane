'use client';

import { useState } from 'react';
import { Reply } from 'lucide-react';
import type { EmailMessageDetail } from '@/types/email';
import { sanitizeEmailHtml } from '@/lib/sanitize';
import { EmailReplyForm } from './EmailReplyForm';

interface EmailReaderProps {
  message: EmailMessageDetail | null;
  isLoading: boolean;
  onAfterReply?: () => void;
}

/**
 * Área de leitura do e-mail. Renderiza HTML sanitizado (DOMPurify) ou,
 * em fallback, texto puro. Inclui o EmailReplyForm inline na parte inferior.
 */
export function EmailReader({ message, isLoading, onAfterReply }: EmailReaderProps) {
  const [replyOpen, setReplyOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="w-1/2 flex flex-col bg-muted/10 p-6 gap-4">
        <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
        <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded-2xl mt-4" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="w-1/2 flex flex-col items-center justify-center text-muted-foreground p-8 gap-3 bg-muted/10">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Reply className="w-7 h-7 opacity-30" />
        </div>
        <p className="text-sm">Selecione um e-mail para ler</p>
      </div>
    );
  }

  const sanitizedHtml = message.html ? sanitizeEmailHtml(message.html) : null;

  return (
    <div className="w-1/2 flex flex-col bg-muted/10 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card">
        <h2 className="text-xl font-bold mb-3 leading-tight">{message.subject || '(sem assunto)'}</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-base shrink-0">
            {(message.from || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{message.from}</div>
            <div className="text-[10px] text-muted-foreground">
              {message.date ? new Date(message.date).toLocaleString('pt-BR') : ''}
              {message.attachmentsCount > 0 && (
                <span className="ml-2">📎 {message.attachmentsCount} anexo(s)</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setReplyOpen((v) => !v)}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-600 transition-colors flex items-center gap-2"
          >
            <Reply className="w-4 h-4" /> Responder
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {sanitizedHtml ? (
          <div
            className="bg-card rounded-2xl border border-border p-5 text-sm leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        ) : (
          <div className="bg-card rounded-2xl border border-border p-5 text-sm leading-relaxed whitespace-pre-wrap">
            {message.text || '(mensagem vazia)'}
          </div>
        )}

        {replyOpen && (
          <EmailReplyForm
            uid={String(message.uid)}
            onCancel={() => setReplyOpen(false)}
            onSent={() => {
              setReplyOpen(false);
              onAfterReply?.();
            }}
          />
        )}
      </div>
    </div>
  );
}