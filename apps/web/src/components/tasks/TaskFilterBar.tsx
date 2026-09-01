'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Filter, X, Search, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import React from 'react';

export interface TaskFilters {
  search?: string;
  statusId?: string;
  assigneeTenantUserId?: string;
  priorityId?: string;
  projectId?: string;
  tagId?: string;
  overdue?: string;
  completed?: string;
  myTasks?: string;
  blocked?: string;
  startDateFrom?: string;
  startDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

interface TaskFilterBarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  totalTasks: number;
  filteredCount: number;
}

export function TaskFilterBar({ filters, onFiltersChange, totalTasks, filteredCount }: TaskFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Fetch filter options
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users?active=true').then((r) => r.data),
  });

  const { data: statuses } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => api.get('/tasks/statuses').then((r) => r.data),
  });

  const { data: priorities } = useQuery({
    queryKey: ['priorities'],
    queryFn: () => api.get('/tasks/priorities').then((r) => r.data),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r) => r.data),
  });

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get('/tasks/tags').then((r) => r.data),
  });

  const updateFilter = (key: keyof TaskFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      {/* Filter bar header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30 flex-wrap">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-primary text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Search always visible */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar tarefas..."
            value={filters.search || ''}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Quick toggles always visible */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateFilter('myTasks', filters.myTasks === 'true' ? '' : 'true')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filters.myTasks === 'true'
                ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Minhas Tarefas
          </button>
          <button
            onClick={() => updateFilter('overdue', filters.overdue === 'true' ? '' : 'true')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filters.overdue === 'true'
                ? 'bg-red-500 text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Atrasadas
          </button>
          <button
            onClick={() => updateFilter('blocked', filters.blocked === 'true' ? '' : 'true')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filters.blocked === 'true'
                ? 'bg-amber-500 text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Bloqueadas
          </button>
        </div>

        {/* Result count */}
        <div className="text-xs text-muted-foreground ml-auto">
          {hasActiveFilters ? (
            <span>Mostrando <strong>{filteredCount}</strong> de {totalTasks} tarefas</span>
          ) : (
            <span>{totalTasks} tarefas</span>
          )}
        </div>

        {/* Clear button */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" /> Limpar
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="px-4 py-4 border-b border-border bg-muted/20">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Status */}
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">Status</label>
              <select
                value={filters.statusId || ''}
                onChange={(e) => updateFilter('statusId', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos</option>
                {(statuses || []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Responsável */}
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">Responsável</label>
              <select
                value={filters.assigneeTenantUserId || ''}
                onChange={(e) => updateFilter('assigneeTenantUserId', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos</option>
                {(users || []).filter((u: any) => u.isActive !== false).map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.user?.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Prioridade */}
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">Prioridade</label>
              <select
                value={filters.priorityId || ''}
                onChange={(e) => updateFilter('priorityId', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todas</option>
                {(priorities || []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Projeto */}
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">Projeto</label>
              <select
                value={filters.projectId || ''}
                onChange={(e) => updateFilter('projectId', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos</option>
                {(projects || []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">Tag</label>
              <select
                value={filters.tagId || ''}
                onChange={(e) => updateFilter('tagId', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todas</option>
                {(tags || []).map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Concluídas */}
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">Status</label>
              <select
                value={filters.completed || ''}
                onChange={(e) => updateFilter('completed', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todas</option>
                <option value="true">Concluídas</option>
                <option value="false">Em aberto</option>
              </select>
            </div>
          </div>

          {/* Date filters row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">Prazo de</label>
              <input
                type="date"
                value={filters.dueDateFrom || ''}
                onChange={(e) => updateFilter('dueDateFrom', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">Prazo até</label>
              <input
                type="date"
                value={filters.dueDateTo || ''}
                onChange={(e) => updateFilter('dueDateTo', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">Início de</label>
              <input
                type="date"
                value={filters.startDateFrom || ''}
                onChange={(e) => updateFilter('startDateFrom', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">Início até</label>
              <input
                type="date"
                value={filters.startDateTo || ''}
                onChange={(e) => updateFilter('startDateTo', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* Active filter tags */}
      {hasActiveFilters && !isExpanded && (
        <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
          {filters.statusId && (
            <FilterTag 
              label={`Status: ${(statuses || []).find((s: any) => s.id === filters.statusId)?.name || ''}`}
              onRemove={() => updateFilter('statusId', '')}
            />
          )}
          {filters.assigneeTenantUserId && (
            <FilterTag
              label={`Responsável: ${(users || []).find((u: any) => u.id === filters.assigneeTenantUserId)?.user?.name || ''}`}
              onRemove={() => updateFilter('assigneeTenantUserId', '')}
            />
          )}
          {filters.priorityId && (
            <FilterTag
              label={`Prioridade: ${(priorities || []).find((p: any) => p.id === filters.priorityId)?.name || ''}`}
              onRemove={() => updateFilter('priorityId', '')}
            />
          )}
          {filters.projectId && (
            <FilterTag
              label={`Projeto: ${(projects || []).find((p: any) => p.id === filters.projectId)?.name || ''}`}
              onRemove={() => updateFilter('projectId', '')}
            />
          )}
          {filters.tagId && (
            <FilterTag
              label={`Tag: ${(tags || []).find((t: any) => t.id === filters.tagId)?.name || ''}`}
              onRemove={() => updateFilter('tagId', '')}
            />
          )}
          {filters.completed && (
            <FilterTag
              label={filters.completed === 'true' ? 'Concluídas' : 'Em aberto'}
              onRemove={() => updateFilter('completed', '')}
            />
          )}
          {filters.dueDateFrom && (
            <FilterTag label={`Prazo desde ${filters.dueDateFrom}`} onRemove={() => updateFilter('dueDateFrom', '')} />
          )}
          {filters.dueDateTo && (
            <FilterTag label={`Prazo até ${filters.dueDateTo}`} onRemove={() => updateFilter('dueDateTo', '')} />
          )}
          {filters.startDateFrom && (
            <FilterTag label={`Início desde ${filters.startDateFrom}`} onRemove={() => updateFilter('startDateFrom', '')} />
          )}
          {filters.startDateTo && (
            <FilterTag label={`Início até ${filters.startDateTo}`} onRemove={() => updateFilter('startDateTo', '')} />
          )}
        </div>
      )}
    </div>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-lg">
      {label}
      <button onClick={onRemove} className="hover:text-primary-600">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
