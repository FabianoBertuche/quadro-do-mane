import type { AiActionProposal } from '@/lib/ai-chat';

interface AiActionProposalCardProps {
  proposal: AiActionProposal;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AiActionProposalCard({ proposal, busy, onConfirm, onCancel }: AiActionProposalCardProps) {
  if (proposal.status !== 'PENDING') return null;

  return (
    <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm dark:bg-amber-950/20">
      <p className="font-semibold text-amber-900 dark:text-amber-200">Ação aguardando confirmação</p>
      <p className="mt-1 text-amber-800/80 dark:text-amber-100/80">{proposal.summary || proposal.toolName || 'Ação da assistente'}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onConfirm} disabled={busy} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? 'Processando...' : 'Confirmar'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}
