'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Plus,
  Search,
  Phone,
  Mail,
  Building2,
  MessageCircle,
  ChevronRight,
  ChevronDown,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface ToastState {
  kind: 'success' | 'error' | 'info';
  text: string;
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  // auto-dismiss em 4s
  useState(() => {
    setTimeout(onClose, 4000);
    return null;
  });
  const styles =
    toast.kind === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : toast.kind === 'info'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-rose-50 text-rose-700 border-rose-200';
  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-md pl-4 pr-10 py-3 rounded-xl shadow-lg text-sm font-medium border ${styles}`}
      role="status"
    >
      {toast.text}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 rounded-lg hover:bg-black/5"
        aria-label="Fechar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

/**
 * Sanitiza telefone para a URL do WhatsApp.
 * Mantém apenas dígitos e o "+" inicial (se houver).
 * Ex.: "(19) 99999-1234" → "5519999991234" (com 55 quando tiver DDI 12 dígitos)
 */
function sanitizePhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;
  // Remove tudo que não for dígito ou "+" inicial
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  // Se tiver 10–11 dígitos (BR sem DDI), prefixa 55
  let normalized = digits;
  if (digits.length >= 10 && digits.length <= 11) {
    normalized = '55' + digits;
  }
  return (hasPlus ? '+' : '') + normalized;
}

function buildWhatsAppUrl(phone: string | null | undefined, message: string): string | null {
  const num = sanitizePhoneForWhatsApp(phone);
  if (!num) return null;
  const clean = num.replace(/^\+/, '');
  const text = encodeURIComponent(message);
  return `https://wa.me/${clean}?text=${text}`;
}

function extractErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  if (typeof data?.message === 'string') return data.message;
  return fallback;
}

// ────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  extension?: string | null;
  company?: string | null;
  department?: string | null;
  role?: string | null;
  notes?: string | null;
}

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  mobile: string;
  company: string;
  department: string;
  role: string;
  extension: string;
  notes: string;
}

const EMPTY_FORM: ContactFormData = {
  name: '',
  email: '',
  phone: '',
  mobile: '',
  company: '',
  department: '',
  role: '',
  extension: '',
  notes: '',
};

function contactToForm(c: Contact): ContactFormData {
  return {
    name: c.name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    mobile: c.mobile ?? '',
    company: c.company ?? '',
    department: c.department ?? '',
    role: c.role ?? '',
    extension: c.extension ?? '',
    notes: c.notes ?? '',
  };
}

// ────────────────────────────────────────────────────────────────────────
// Card expansível
// ────────────────────────────────────────────────────────────────────────

function ContactRow({
  contact,
  onToast,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  onToast: (t: ToastState) => void;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // WhatsApp: prioriza mobile, depois phone
  const whatsNum = sanitizePhoneForWhatsApp(contact.mobile || contact.phone);
  const whatsUrl = buildWhatsAppUrl(contact.mobile || contact.phone, `Olá, ${contact.name.split(' ')[0]}! Tudo bem?`);

  const copyPhone = async () => {
    if (!contact.phone) return;
    try {
      await navigator.clipboard.writeText(contact.phone);
      onToast({ kind: 'success', text: `Telefone copiado: ${contact.phone}` });
    } catch {
      onToast({ kind: 'error', text: 'Não foi possível copiar o telefone.' });
    }
  };

  return (
    <div
      className={`rounded-xl border bg-card transition-all ${
        expanded ? 'border-primary/30 shadow-md' : 'border-border hover:border-primary/20'
      }`}
    >
      {/* Linha compacta */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-xl"
      >
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-primary">
            {(contact.name || '?').trim().charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{contact.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {contact.phone || contact.mobile || <span className="italic">sem telefone</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Botão WhatsApp inline (também visível no card expandido) */}
          {whatsUrl && (
            <a
              href={whatsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
              title={`Conversar com ${contact.name} no WhatsApp`}
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          )}
          {/* Botão Editar inline */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(contact);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onEdit(contact);
              }
            }}
            className="p-2 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
            title={`Editar ${contact.name}`}
          >
            <Pencil className="w-4 h-4" />
          </span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Card expandido */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-border/50 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm pt-3">
            {contact.email && (
              <Field
                icon={<Mail className="w-3.5 h-3.5" />}
                label="E-mail"
                value={contact.email}
                href={`mailto:${contact.email}`}
              />
            )}
            <Field
              icon={<Phone className="w-3.5 h-3.5" />}
              label="Telefone"
              value={contact.phone}
              onCopy={copyPhone}
            />
            {contact.mobile && (
              <Field
                icon={<Phone className="w-3.5 h-3.5" />}
                label="Celular"
                value={contact.mobile}
              />
            )}
            {contact.extension && (
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground mt-0.5">Ramal</span>
                <span className="font-mono">{contact.extension}</span>
              </div>
            )}
            {contact.company && (
              <Field
                icon={<Building2 className="w-3.5 h-3.5" />}
                label="Empresa"
                value={contact.company}
              />
            )}
            {contact.department && (
              <Field label="Departamento" value={contact.department} />
            )}
            {contact.role && <Field label="Cargo" value={contact.role} />}
          </div>

          {contact.notes && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 border border-border/40">
              <div className="font-semibold text-foreground mb-1">Observações</div>
              {contact.notes}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {whatsUrl ? (
              <a
                href={whatsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors shadow-md shadow-emerald-500/20"
              >
                <MessageCircle className="w-4 h-4" />
                Conversar no WhatsApp
                {whatsNum && <span className="text-xs opacity-80 ml-1">({whatsNum})</span>}
              </a>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Adicione telefone ou celular para abrir conversa no WhatsApp.
              </p>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => onEdit(contact)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </button>
              <button
                type="button"
                onClick={() => onDelete(contact)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  href,
  onCopy,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string | null;
  href?: string;
  onCopy?: () => void;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </div>
        {href ? (
          <a
            href={href}
            className="text-primary hover:underline truncate block"
            target="_blank"
            rel="noopener noreferrer"
          >
            {value}
          </a>
        ) : (
          <div className="truncate">{value}</div>
        )}
      </div>
      {onCopy && (
        <button
          onClick={onCopy}
          className="text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded"
          title="Copiar"
        >
          copiar
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Modal de criação / edição
// ────────────────────────────────────────────────────────────────────────

function ContactFormModal({
  open,
  mode, // 'create' | 'edit'
  initial,
  pending,
  errorMessage,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  initial: ContactFormData;
  pending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (data: ContactFormData) => void;
}) {
  const [data, setData] = useState<ContactFormData>(initial);

  // Reaplica o `initial` toda vez que o modal abrir
  useEffect(() => {
    if (open) setData(initial);
  }, [open, initial]);

  const update = (patch: Partial<ContactFormData>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim()) return;
    onSubmit(data);
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar Contato' : 'Novo Contato'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Nome <span className="text-rose-500">*</span>
          </label>
          <input
            required
            type="text"
            value={data.name}
            onChange={(e) => update({ name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">E-mail</label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => update({ email: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Telefone</label>
            <input
              type="text"
              value={data.phone}
              onChange={(e) => update({ phone: e.target.value })}
              placeholder="(19) 99999-1234"
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Celular</label>
            <input
              type="text"
              value={data.mobile}
              onChange={(e) => update({ mobile: e.target.value })}
              placeholder="(19) 99999-1234"
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Empresa</label>
            <input
              type="text"
              value={data.company}
              onChange={(e) => update({ company: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Cargo</label>
            <input
              type="text"
              value={data.role}
              onChange={(e) => update({ role: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Departamento</label>
            <input
              type="text"
              value={data.department}
              onChange={(e) => update({ department: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Ramal</label>
            <input
              type="text"
              value={data.extension}
              onChange={(e) => update({ extension: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Observações</label>
          <textarea
            value={data.notes}
            onChange={(e) => update({ notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        {errorMessage && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
            {errorMessage}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md shadow-primary/30"
          >
            {pending
              ? mode === 'edit'
                ? 'Salvando...'
                : 'Criando...'
              : mode === 'edit'
              ? 'Salvar Alterações'
              : 'Criar Contato'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Modal de confirmação de exclusão
// ────────────────────────────────────────────────────────────────────────

function ConfirmDeleteModal({
  open,
  contact,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  contact: Contact | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} title="Excluir contato">
      <div className="space-y-4">
        <p className="text-sm text-foreground">
          Tem certeza que deseja excluir o contato{' '}
          <span className="font-semibold">{contact?.name}</span>?
          Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="px-6 py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-md shadow-rose-600/30"
          >
            {pending ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Página
// ────────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const queryClient = useQueryClient();

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ['contacts', search],
    queryFn: () => api.get('/contacts', { params: { search } }).then((r) => r.data),
  });

  const filteredAndSorted = useMemo(() => {
    const list = contacts ?? [];
    // Backend já filtra por search, mas defensivamente aplicamos lower-case aqui também
    const s = search.trim().toLowerCase();
    const visible = s
      ? list.filter((c) =>
          (c.name + ' ' + (c.email ?? '') + ' ' + (c.phone ?? '') + ' ' + (c.company ?? ''))
            .toLowerCase()
            .includes(s),
        )
      : list;
    return [...visible].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
    );
  }, [contacts, search]);

  const createMutation = useMutation({
    mutationFn: (data: ContactFormData) => {
      const payload: Record<string, string> = { name: data.name.trim() };
      const trimOrUndef = (v: string) => (v.trim() ? v.trim() : undefined);
      const email = trimOrUndef(data.email);
      const phone = trimOrUndef(data.phone);
      const mobile = trimOrUndef(data.mobile);
      const company = trimOrUndef(data.company);
      const department = trimOrUndef(data.department);
      const role = trimOrUndef(data.role);
      const extension = trimOrUndef(data.extension);
      const notes = trimOrUndef(data.notes);
      if (email) payload.email = email;
      if (phone) payload.phone = phone;
      if (mobile) payload.mobile = mobile;
      if (company) payload.company = company;
      if (department) payload.department = department;
      if (role) payload.role = role;
      if (extension) payload.extension = extension;
      if (notes) payload.notes = notes;
      return api.post('/contacts', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setFormMode(null);
      setFormError(null);
      setToast({ kind: 'success', text: 'Contato criado com sucesso' });
    },
    onError: (err: any) => {
      if (err?.response?.status === 403) {
        setFormError('Você não tem permissão para criar contatos.');
      } else {
        setFormError(extractErrorMessage(err, 'Erro ao criar contato'));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContactFormData }) => {
      const payload: Record<string, string | null> = {};
      const trimOrUndef = (v: string) => (v.trim() ? v.trim() : undefined);
      const email = trimOrUndef(data.email);
      const phone = trimOrUndef(data.phone);
      const mobile = trimOrUndef(data.mobile);
      const company = trimOrUndef(data.company);
      const department = trimOrUndef(data.department);
      const role = trimOrUndef(data.role);
      const extension = trimOrUndef(data.extension);
      const notes = trimOrUndef(data.notes);
      // nome é obrigatório — sempre envia (já validado no submit)
      payload.name = data.name.trim();
      payload.email = email ?? null;
      payload.phone = phone ?? null;
      payload.mobile = mobile ?? null;
      payload.company = company ?? null;
      payload.department = department ?? null;
      payload.role = role ?? null;
      payload.extension = extension ?? null;
      payload.notes = notes ?? null;
      return api.patch(`/contacts/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setFormMode(null);
      setEditing(null);
      setFormError(null);
      setToast({ kind: 'success', text: 'Contato atualizado com sucesso' });
    },
    onError: (err: any) => {
      if (err?.response?.status === 403) {
        setFormError('Você não tem permissão para editar contatos.');
      } else {
        setFormError(extractErrorMessage(err, 'Erro ao atualizar contato'));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setContactToDelete(null);
      setToast({ kind: 'success', text: 'Contato excluído com sucesso' });
    },
    onError: (err: any) => {
      if (err?.response?.status === 403) {
        setToast({ kind: 'error', text: 'Você não tem permissão para excluir contatos.' });
      } else {
        setToast({ kind: 'error', text: extractErrorMessage(err, 'Erro ao excluir contato') });
      }
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormMode('create');
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setFormError(null);
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditing(null);
    setFormError(null);
  };

  const handleSubmit = (data: ContactFormData) => {
    if (!data.name.trim()) {
      setFormError('O nome é obrigatório.');
      return;
    }
    setFormError(null);
    if (formMode === 'edit' && editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const initialForm: ContactFormData =
    formMode === 'edit' && editing ? contactToForm(editing) : EMPTY_FORM;

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contatos</h1>
          <p className="text-muted-foreground mt-1">
            Agenda telefônica corporativa ·{' '}
            {filteredAndSorted.length} contato{filteredAndSorted.length !== 1 && 's'}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 transition-colors shadow-lg shadow-primary/30"
        >
          <Plus className="w-4 h-4" /> Novo Contato
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar contatos..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
          Nenhum contato encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAndSorted.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              onToast={setToast}
              onEdit={openEdit}
              onDelete={(contact) => setContactToDelete(contact)}
            />
          ))}
        </div>
      )}

      <ContactFormModal
        open={formMode !== null}
        mode={formMode ?? 'create'}
        initial={initialForm}
        pending={createMutation.isPending || updateMutation.isPending}
        errorMessage={formError}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <ConfirmDeleteModal
        open={contactToDelete !== null}
        contact={contactToDelete}
        pending={deleteMutation.isPending}
        onClose={() => setContactToDelete(null)}
        onConfirm={() => {
          if (contactToDelete) deleteMutation.mutate(contactToDelete.id);
        }}
      />
    </div>
  );
}
