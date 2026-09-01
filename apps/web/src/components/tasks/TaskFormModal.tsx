'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, X, FileText, Download, AlertCircle, Upload } from 'lucide-react';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    id?: string;
    title?: string;
    description?: string;
    projectId?: string;
    statusId?: string;
    priorityId?: string;
    assigneeTenantUserId?: string;
    startDate?: string;
    dueDate?: string;
  };
  defaultProjectId?: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function TaskFormModal({ isOpen, onClose, initialData, defaultProjectId }: TaskFormModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    id: '',
    title: '',
    description: '',
    projectId: defaultProjectId || '',
    statusId: '',
    priorityId: '',
    assigneeTenantUserId: '',
    startDate: '',
    dueDate: '',
  });

  useEffect(() => {
    if (isOpen) {
      setCreatedTaskId(null);
      setUploadError(null);
      setPendingFiles([]);
      if (initialData?.id) {
        setFormData({
          id: initialData.id || '',
          title: initialData.title || '',
          description: initialData.description || '',
          projectId: initialData.projectId || defaultProjectId || '',
          statusId: initialData.statusId || '',
          priorityId: initialData.priorityId || '',
          assigneeTenantUserId: initialData.assigneeTenantUserId || '',
          startDate: initialData.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : '',
          dueDate: initialData.dueDate ? new Date(initialData.dueDate).toISOString().split('T')[0] : '',
        });
      } else {
        setFormData({
          id: '',
          title: '',
          description: '',
          projectId: defaultProjectId || '',
          statusId: '',
          priorityId: '',
          assigneeTenantUserId: '',
          startDate: '',
          dueDate: '',
        });
      }
    }
  }, [isOpen, initialData, defaultProjectId]);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users?active=true').then((r) => r.data),
    enabled: isOpen,
  });

  const { data: statuses } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => api.get('/tasks/statuses').then((r) => r.data),
    enabled: isOpen,
  });

  const { data: priorities } = useQuery({
    queryKey: ['priorities'],
    queryFn: () => api.get('/tasks/priorities').then((r) => r.data),
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const payload: any = { ...data };
      const taskId = payload.id;
      delete payload.id;

      if (!payload.statusId) delete payload.statusId;

      payload.priorityId = payload.priorityId || (taskId ? null : undefined);
      payload.assigneeTenantUserId = payload.assigneeTenantUserId || (taskId ? null : undefined);
      payload.projectId = payload.projectId || (taskId ? null : undefined);
      payload.startDate = payload.startDate ? new Date(payload.startDate).toISOString() : (taskId ? null : undefined);
      payload.dueDate = payload.dueDate ? new Date(payload.dueDate).toISOString() : (taskId ? null : undefined);

      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      if (taskId) {
        return api.patch(`/tasks/${taskId}`, payload).then((r) => r.data);
      }
      return api.post('/tasks', payload).then((r) => r.data);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (!formData.id && result?.id) {
        setCreatedTaskId(result.id);
      } else {
        onClose();
      }
    },
  });

  const uploadAttachment = useMutation({
    mutationFn: ({ taskId, file }: { taskId: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/upload/tasks/${taskId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300_000,
      }).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setUploadError(null);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message;
      if (typeof msg === 'string') {
        setUploadError(msg);
      } else if (Array.isArray(msg) && msg.length > 0) {
        setUploadError(msg[0]);
      } else {
        setUploadError('Erro ao enviar arquivo.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setUploadError(null);
      const newFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setUploadError(`"${file.name}" excede o limite de 100 MB.`);
          continue;
        }
        newFiles.push(file);
      }
      setPendingFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (!createdTaskId || pendingFiles.length === 0) return;
    for (const file of pendingFiles) {
      await uploadAttachment.mutateAsync({ taskId: createdTaskId, file });
    }
    setPendingFiles([]);
  };

  const isEditing = !!formData.id;
  const isCreated = !!createdTaskId;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `Editar: ${formData.title}` : isCreated ? 'Tarefa Criada' : 'Nova Tarefa'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Título da Tarefa</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Ex: Atualizar layout da página home"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            placeholder="Descreva a tarefa..."
          />
        </div>

        {!defaultProjectId && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Projeto (opcional)</label>
            <input
              type="text"
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="ID do projeto"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
            <select
              value={formData.statusId}
              onChange={(e) => setFormData({ ...formData, statusId: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Status padrão</option>
              {(statuses || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Prioridade</label>
            <select
              value={formData.priorityId}
              onChange={(e) => setFormData({ ...formData, priorityId: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Sem prioridade</option>
              {(priorities || []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Responsável</label>
          <select
            value={formData.assigneeTenantUserId}
            onChange={(e) => setFormData({ ...formData, assigneeTenantUserId: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Nenhum responsável</option>
            {(users || []).filter((u: any) => u.isActive !== false).map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.user?.name} {u.role?.name ? `(${u.role.name})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Data Inicial Prevista</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Prazo de Entrega</label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex justify-between pt-2 items-center">
          {formData.id && (
            <span className="text-xs text-muted-foreground mr-auto">Deixe vazio para limpar status ou responsável.</span>
          )}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md shadow-primary/30 ml-auto"
          >
            {createMutation.isPending ? 'Salvando...' : formData.id ? 'Salvar Alterações' : 'Criar Tarefa'}
          </button>
        </div>
      </form>

      {/* Attachments Section - shown after task creation */}
      {isCreated && (
        <div className="mt-6 pt-4 border-t border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Anexos</h3>
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
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {uploadError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Pending files */}
          {pendingFiles.length > 0 && (
            <div className="space-y-2">
              {pendingFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    onClick={() => removePendingFile(idx)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={handleUploadAll}
                disabled={uploadAttachment.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                {uploadAttachment.isPending ? 'Enviando...' : `Enviar ${pendingFiles.length} arquivo(s)`}
              </button>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors text-sm"
            >
              {pendingFiles.length > 0 ? 'Pular por agora' : 'Concluir'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
