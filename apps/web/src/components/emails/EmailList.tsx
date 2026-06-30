'use client';

import { Inbox, RefreshCw, Mail } from 'lucide-react';
import type { EmailMessageSummary } from '@/types/email';

interface EmailListProps {
  messages: EmailMessageSummary[] | undefined;
  isLoading: boolean;
  selectedUid: string | number | null;
  onSelect: (msg: EmailMessageSummary) => void;
  onRefresh: () => void;
}

/**
 * Lista de mensagens da INBOX (últimas 20).
 *
 * Mostra remetente, assunto, snippet e data. Suporta clique para selecionar.
 */
export function EmailList({
  messages,
  isLoading,
  selectedUid,
  onSelect,
  onRefresh,
}: EmailListProps) {
  return (
    <div className="w-1/2 border-r border-border flex flex-col overflow-hidden bg-card">
      <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
        <h3 className="font-bold flex items-center gap-2">
          <Inbox className="w-4 h-4 text-primary" /> Caixa de Entrada
        </h3>
        <button
          onClick={onRefresh}
          className="p-2 hover:bg-muted rounded-full transition-colors"
          aria-label="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !messages || messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 gap-3">
          <Mail className="w-12 h-12 opacity-20" />
          <p className="text-sm">Nenhuma mensagem na caixa de entrada.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {messages.map((msg) => {
            const isSelected = String(msg.uid) === String(selectedUid);
            return (
              <div
                key={msg.uid}
                onClick={() => onSelect(msg)}
                className={`p-4 cursor-pointer transition-colors group ${
                  isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span
                    className={`text-sm truncate ${
                      msg.seen ? 'font-medium text-foreground/80' : 'font-bold text-foreground'
                    }`}
                  >
                    {msg.from || '(remetente desconhecido)'}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {msg.date ? new Date(msg.date).toLocaleDateString('pt-BR') : ''}
                  </span>
                </div>
                <div
                  className={`text-xs truncate ${
                    msg.seen ? 'text-muted-foreground' : 'font-semibold text-foreground'
                  }`}
                >
                  {msg.subject || '(sem assunto)'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}