'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  X,
  Paperclip,
  Send,
  Trash2,
  Download,
  FileText,
  Calendar,
  User,
  Folder,
  AlertCircle,
  Edit2,
  Save,
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth';

interface TaskDetailModalProps {
  task: any;
  onClose: () => void;
  defaultEdit?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} minuto${diffMin > 1 ? 's' : ''}`;
  if (diffHr < 24) return `há ${diffHr} hora${diffHr > 1 ? 's' : ''}`;
  if (diffDay < 7) return `há ${diffDay} dia${diffDay > 1 ? 's' : ''}`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const priorityStyles: Record<string, string> = {
  Baixa: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
  Normal: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Alta: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  Urgente: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

export function TaskDetailModal({ task, onClose, defaultEdit }: TaskDetailModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newComment, setNewComment] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; mimeType: string } | null>(null);
  const [isEditing, setIsEditing] = useState(defaultEdit ?? false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    statusId: '',
    priorityId: '',
    assigneeTenantUserId: '',
    startDate: '',
    dueDate: '',
  });

  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.role) === 'admin' || useAuthStore((s) => s.permissions?.includes('tasks.delete'));

  // Fetch full task details
  const { data: taskDetail, isLoading: taskLoading } = useQuery({
    queryKey: ['task', task?.id],
    queryFn: () => api.get(`/tasks/${task.id}`).then((r) => r.data),
    enabled: !!task?.id,
  });

  // Fetch comments
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['task-comments', task?.id],
    queryFn: () => api.get(`/tasks/${task.id}/comments`).then((r) => r.data),
    enabled: !!task?.id,
  });

  // Fetch dropdown data for edit form
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users?active=true').then((r) => r.data),
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => api.get('/tasks/statuses').then((r) => r.data),
  });

  const { data: priorities = [] } = useQuery({
    queryKey: ['priorities'],
    queryFn: () => api.get('/tasks/priorities').then((r) => r.data),
  });

  // Create comment mutation
  const createComment = useMutation({
    mutationFn: (content: string) =>
      api.post(`/tasks/${task.id}/comments`, { content }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', task.id] });
      setNewComment('');
    },
  });

  // Upload attachment mutation
  const uploadAttachment = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/upload/tasks/${task.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300_000, // 5 minutes for large file uploads
      }).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
      setUploadError(null);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message;
      if (typeof msg === 'string') {
        setUploadError(msg);
      } else if (Array.isArray(msg) && msg.length > 0) {
        setUploadError(msg[0]);
      } else {
        setUploadError('Erro ao enviar arquivo. Tente novamente.');
      }
    },
  });

  // Delete attachment mutation
  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: string) =>
      api.delete(`/tasks/${task.id}/attachments/${attachmentId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
      setDeleteTarget(null);
    },
  });

  // Update task mutation
  const updateTask = useMutation({
    mutationFn: (data: typeof editForm) => {
      const payload: any = { ...data };
      if (!payload.statusId) delete payload.statusId;
      payload.priorityId = payload.priorityId || null;
      payload.assigneeTenantUserId = payload.assigneeTenantUserId || null;
      payload.startDate = payload.startDate ? new Date(payload.startDate).toISOString() : null;
      payload.dueDate = payload.dueDate ? new Date(payload.dueDate).toISOString() : null;
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
      return api.patch(`/tasks/${task.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsEditing(false);
    },
  });

  const handleSubmitComment = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    createComment.mutate(trimmed);
  };

  const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadError(null);
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setUploadError(
          `O arquivo "${file.name}" tem ${sizeMB} MB e excede o limite máximo de 100 MB. Reduza o tamanho do arquivo e tente novamente.`
        );
        e.target.value = '';
        return;
      }
      uploadAttachment.mutate(file);
    }
    e.target.value = '';
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    if (deleteTarget === attachmentId) {
      deleteAttachment.mutate(attachmentId);
    } else {
      setDeleteTarget(attachmentId);
    }
  };

  const detail = taskDetail || task;

  const handleStartEdit = () => {
    setEditForm({
      title: detail?.title || '',
      description: detail?.description || '',
      statusId: detail?.statusId || '',
      priorityId: detail?.priorityId || '',
      assigneeTenantUserId: detail?.assigneeTenantUserId || '',
      startDate: detail?.startDate ? new Date(detail.startDate).toISOString().split('T')[0] : '',
      dueDate: detail?.dueDate ? new Date(detail.dueDate).toISOString().split('T')[0] : '',
    });
    setIsEditing(true);
  };

  // Auto-populate edit form when defaultEdit is true and detail data loads
  useEffect(() => {
    if (isEditing && detail && !editForm.title && detail.title) {
      setEditForm({
        title: detail.title || '',
        description: detail.description || '',
        statusId: detail.statusId || '',
        priorityId: detail.priorityId || '',
        assigneeTenantUserId: detail.assigneeTenantUserId || '',
        startDate: detail.startDate ? new Date(detail.startDate).toISOString().split('T')[0] : '',
        dueDate: detail.dueDate ? new Date(detail.dueDate).toISOString().split('T')[0] : '',
      });
    }
  }, [isEditing, detail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-bold text-foreground leading-snug">
              {detail?.title || 'Carregando...'}
            </h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {detail?.status && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted border border-border">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: detail.status.color }}
                  />
                  {detail.status.name}
                </span>
              )}
              {detail?.priority && (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    priorityStyles[detail.priority.name] || 'bg-muted text-muted-foreground'
                  }`}
                >
                  {detail.priority.name}
                </span>
              )}
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={handleStartEdit}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors shrink-0"
              title="Editar tarefa"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(85vh-80px)] overflow-y-auto">
          <div className="p-5 space-y-6">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Título</label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Descrição</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Descreva a tarefa..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
                    <select
                      value={editForm.statusId}
                      onChange={(e) => setEditForm({ ...editForm, statusId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Sem status</option>
                      {statuses.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Prioridade</label>
                    <select
                      value={editForm.priorityId}
                      onChange={(e) => setEditForm({ ...editForm, priorityId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Sem prioridade</option>
                      {priorities.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Responsável</label>
                  <select
                    value={editForm.assigneeTenantUserId}
                    onChange={(e) => setEditForm({ ...editForm, assigneeTenantUserId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Nenhum responsável</option>
                    {(users || []).filter((u: any) => u.isActive !== false).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.user?.name} {u.role?.name ? `(${u.role.name})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Data Inicial</label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Prazo</label>
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => updateTask.mutate(editForm)}
                    disabled={!editForm.title.trim() || updateTask.isPending}
                    className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md shadow-primary/30 inline-flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {updateTask.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            ) : (
              <>
            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <InfoCard
                icon={<User className="w-4 h-4" />}
                label="Responsável"
                value={detail?.assignee?.user?.name || 'Não atribuído'}
              />
              <InfoCard
                icon={<Folder className="w-4 h-4" />}
                label="Projeto"
                value={detail?.project?.name || 'Sem projeto'}
              />
              <InfoCard
                icon={<Calendar className="w-4 h-4" />}
                label="Início"
                value={
                  detail?.startDate
                    ? new Date(detail.startDate).toLocaleDateString('pt-BR')
                    : 'Não definido'
                }
              />
              <InfoCard
                icon={<Calendar className="w-4 h-4" />}
                label="Prazo"
                value={
                  detail?.dueDate
                    ? new Date(detail.dueDate).toLocaleDateString('pt-BR')
                    : 'Não definido'
                }
              />
            </div>

            {/* Description */}
            {detail?.description && (
              <div className="rounded-xl bg-muted/50 border border-border p-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {detail.description}
                </p>
              </div>
            )}
              </>
            )}

            {/* Comments Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Notas
              </h3>

              {/* New Comment */}
              <div className="flex gap-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Adicione uma nota..."
                  rows={2}
                  className="flex-1 px-4 py-3 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSubmitComment();
                    }
                  }}
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || createComment.isPending}
                  className="self-end px-4 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-40 transition-colors shrink-0"
                  title="Enviar nota (Ctrl+Enter)"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Comments List */}
              {commentsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 bg-muted rounded" />
                        <div className="h-4 w-full bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Nenhuma nota ainda. Seja o primeiro a comentar!
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment: any, idx: number) => (
                    <div
                      key={comment.id}
                      className={`flex gap-3 p-3 rounded-xl ${
                        idx % 2 === 0 ? 'bg-muted/30' : 'bg-transparent'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {comment.author?.user?.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {comment.author?.user?.name || 'Usuário'}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatRelativeTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attachments Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Anexos
                </h3>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAttachment.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {uploadAttachment.isPending ? 'Enviando...' : 'Adicionar arquivo'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {uploadError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Attachments List */}
              {detail?.attachments && detail.attachments.length > 0 ? (
                <div className="space-y-2">
                  {detail.attachments.map((att: any) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border group"
                    >
                      {/* File Icon / Thumbnail */}
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {att.mimeType?.startsWith('image/') ? (
                          <img
                            src={`/api${att.filePath}`}
                            alt={att.fileName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileText className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={() => setPreviewFile({ url: `/api${att.filePath}`, name: att.fileName, mimeType: att.mimeType })}
                        >
                          {att.fileName}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{formatFileSize(att.fileSize)}</span>
                          <span className="opacity-40">|</span>
                          <span>{att.uploadedBy?.user?.name || 'Usuário'}</span>
                          <span className="opacity-40">|</span>
                          <span>{new Date(att.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={`/api${att.filePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                          title="Baixar"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {isAdmin || att.uploadedByTenantUserId === currentUser?.tenantUserId ? (
                          <button
                            onClick={() => handleDeleteAttachment(att.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              deleteTarget === att.id
                                ? 'bg-error/10 text-error hover:bg-error/20'
                                : 'hover:bg-muted text-muted-foreground hover:text-error'
                            }`}
                            title={
                              deleteTarget === att.id ? 'Clique novamente para confirmar' : 'Excluir'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Paperclip className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  Nenhum arquivo anexado.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* File Preview Overlay */}
      {previewFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewFile(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground truncate">{previewFile.name}</h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {previewFile.mimeType?.startsWith('image/') ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[70vh] mx-auto object-contain rounded-lg"
                />
              ) : previewFile.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewFile.url}
                  className="w-full h-[70vh] rounded-lg border border-border"
                  title={previewFile.name}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm">Pré-visualização não disponível para este tipo de arquivo.</p>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-600 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Baixar arquivo
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  );
}
