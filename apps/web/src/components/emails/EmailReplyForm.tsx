'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send, X } from 'lucide-react';
import { emailsApi } from '@/lib/emails-api';

interface EmailReplyFormProps {
  uid: string;
  onSent?: () => void;
  onCancel?: () => void;
}

/**
 * Formulário de reply inline dentro do EmailReader.
 *
 * Envia via POST /emails/reply que preserva o thread (In-Reply-To/References).
 */
export function EmailReplyForm({ uid, onSent, onCancel }: EmailReplyFormProps) {
  const [body, setBody] = useState('');

  const sendMutation = useMutation({
    mutationFn: () => emailsApi.reply({ uid, body }),
    onSuccess: () => {
      onSent?.();
    },
  });

  return (
    <div className="mt-5 p-5 rounded-2xl bg-primary/5 border border-primary/20">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Responder</h4>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder="Escreva sua resposta…"
        className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary outline-none text-sm resize-none"
      />
      {sendMutation.isError && (
        <div className="mt-2 text-xs text-red-600">
          {(sendMutation.error as any)?.response?.data?.message ?? 'Falha ao enviar resposta.'}
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={() => sendMutation.mutate()}
          disabled={sendMutation.isPending || !body.trim()}
          className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-600 disabled:opacity-50 transition-all shadow-md shadow-primary/20 flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          {sendMutation.isPending ? 'Enviando…' : 'Enviar resposta'}
        </button>
      </div>
    </div>
  );
}