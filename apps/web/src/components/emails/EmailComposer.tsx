'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { emailsApi } from '@/lib/emails-api';

interface EmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
}

/**
 * Modal de composição de e-mail novo (não-reply).
 *
 * Envia via POST /emails/send. O remetente é resolvido pelo backend
 * a partir de User.email + EmailTenantSetting + senha do usuário.
 */
export function EmailComposer({ isOpen, onClose, onSent }: EmailComposerProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');

  const sendMutation = useMutation({
    mutationFn: () => emailsApi.send({ to, subject, content }),
    onSuccess: () => {
      onSent?.();
      handleClose();
    },
  });

  function handleClose() {
    setTo('');
    setSubject('');
    setContent('');
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nova mensagem">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMutation.mutate();
        }}
        className="space-y-4"
      >
        <div>
          <label className="text-xs font-bold uppercase text-muted-foreground">Para</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            placeholder="destinatario@empresa.com"
            className="mt-1 w-full px-4 py-2.5 rounded-xl bg-muted border-none focus:ring-2 focus:ring-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-muted-foreground">Assunto</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="mt-1 w-full px-4 py-2.5 rounded-xl bg-muted border-none focus:ring-2 focus:ring-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-muted-foreground">Mensagem</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={8}
            className="mt-1 w-full px-4 py-2.5 rounded-xl bg-muted border-none focus:ring-2 focus:ring-primary outline-none text-sm resize-none"
          />
        </div>

        {sendMutation.isError && (
          <div className="text-xs text-red-600">
            {(sendMutation.error as any)?.response?.data?.message ??
              'Falha ao enviar. Verifique a senha SMTP em Configurações.'}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={sendMutation.isPending}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-primary text-white font-bold hover:bg-primary-600 disabled:opacity-50 shadow-lg shadow-primary/20 transition-all text-sm"
          >
            <Send className="w-4 h-4" />
            {sendMutation.isPending ? 'Enviando…' : 'Enviar agora'}
          </button>
        </div>
      </form>
    </Modal>
  );
}