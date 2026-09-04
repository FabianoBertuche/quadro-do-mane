'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

interface CalendarFormData {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  assigneeTenantUserId: string;
  attendeeIds: string[];
  recurrenceRule: string;
  recurrenceInterval: string;
  recurrenceUnit: string;
  recurrenceEndAt: string;
  remindDaysBefore: string;
}

const emptyForm: CalendarFormData = {
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  assigneeTenantUserId: '',
  attendeeIds: [],
  recurrenceRule: '',
  recurrenceInterval: '1',
  recurrenceUnit: 'month',
  recurrenceEndAt: '',
  remindDaysBefore: '',
};

const RECURRENCE_PRESETS = [
  { value: '', label: 'Não repete', interval: '1', unit: 'month' },
  { value: 'DAILY', label: 'Todo dia', interval: '1', unit: 'day' },
  { value: 'MONTHLY', label: 'A cada 3 meses', interval: '3', unit: 'month' },
  { value: 'YEARLY', label: 'A cada 1 ano', interval: '1', unit: 'year' },
  { value: 'CUSTOM', label: 'Período personalizado', interval: '1', unit: 'day' },
];

const RECURRENCE_UNITS = [
  { value: 'day', label: 'Dia(s)' },
  { value: 'week', label: 'Semana(s)' },
  { value: 'month', label: 'Mês(es)' },
  { value: 'year', label: 'Ano(s)' },
];

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<CalendarFormData>(emptyForm);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const startDate = new Date(year, month, 1).toISOString();
  const endDate = new Date(year, month + 1, 0).toISOString();

  const { data: events } = useQuery({
    queryKey: ['events', year, month],
    queryFn: () => api.get('/events', { params: { startDate, endDate } }).then((r) => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users?active=true').then((r) => r.data),
    enabled: isModalOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: CalendarFormData) => {
      const payload: any = {
        title: data.title,
        description: data.description || undefined,
        startAt: new Date(data.startAt).toISOString(),
        endAt: new Date(data.endAt).toISOString(),
        assigneeTenantUserId: data.assigneeTenantUserId || undefined,
        attendeeIds: data.attendeeIds.length > 0 ? data.attendeeIds : undefined,
      };
      if (data.remindDaysBefore !== '') {
        payload.remindDaysBefore = parseInt(data.remindDaysBefore, 10);
      }
      if (data.recurrenceRule) {
        payload.recurrenceRule = data.recurrenceRule;
        payload.recurrenceInterval = parseInt(data.recurrenceInterval || '1', 10);
        payload.recurrenceUnit = data.recurrenceUnit;
        if (data.recurrenceEndAt) {
          payload.recurrenceEndAt = new Date(`${data.recurrenceEndAt}T23:59:59`).toISOString();
        }
      }
      return api.post('/events', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setIsModalOpen(false);
      setFormData(emptyForm);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handlePresetChange = (value: string) => {
    const preset = RECURRENCE_PRESETS.find((p) => p.value === value);
    setFormData({
      ...formData,
      recurrenceRule: value,
      recurrenceInterval: preset?.interval || '1',
      recurrenceUnit: preset?.unit || 'month',
    });
  };

  const isCustom = formData.recurrenceRule === 'CUSTOM';

  const toggleAttendee = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      attendeeIds: prev.attendeeIds.includes(id)
        ? prev.attendeeIds.filter((a) => a !== id)
        : [...prev.attendeeIds, id],
    }));
  };

  const getEventsForDay = (day: number) =>
    (events || []).filter((e: any) => new Date(e.startAt).getDate() === day);

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const prev = () => setCurrentDate(new Date(year, month - 1, 1));
  const next = () => setCurrentDate(new Date(year, month + 1, 1));

  const today = new Date();
  const isToday = (day: number) => today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendário</h1>
          <p className="text-muted-foreground mt-1">Eventos e compromissos</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 transition-colors shadow-lg shadow-primary/30"
        >
          <Plus className="w-4 h-4" /> Novo Evento
        </button>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={prev} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-lg font-semibold">{monthNames[month]} {year}</h2>
          <button onClick={next} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
          {dayNames.map((day) => (
            <div key={day} className="bg-muted py-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-card min-h-[80px] p-1" />
          ))}
          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            const dayRing = dayEvents.length > 0
              ? 'ring-2 ring-success ring-inset'
              : isToday(day)
                ? 'ring-2 ring-primary ring-inset'
                : '';
            return (
              <div key={day} className={`bg-card min-h-[80px] p-1.5 ${dayRing}`}>
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${isToday(day) ? 'bg-primary text-white' : ''}`}>
                  {day}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((event: any) => (
                    <div key={event.id} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate">{event.title}</div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[10px] text-muted-foreground px-1.5">+{dayEvents.length - 2} mais</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Evento">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Título do Evento</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: Reunião de Alinhamento"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Descrição (opcional)</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Detalhes sobre o evento..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Data de Início</label>
              <input
                type="datetime-local"
                required
                value={formData.startAt}
                onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Data Final</label>
              <input
                type="datetime-local"
                required
                value={formData.endAt}
                onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
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
                <option key={u.id} value={u.id}>{u.user?.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Participantes</label>
            <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto p-3 rounded-xl bg-muted border border-border">
              {(users || []).filter((u: any) => u.isActive !== false).map((u: any) => {
                const checked = formData.attendeeIds.includes(u.id);
                return (
                  <label key={u.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-primary/10 text-primary' : 'hover:bg-card'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAttendee(u.id)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">{u.user?.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Lembrete</label>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                min={0}
                value={formData.remindDaysBefore}
                onChange={(e) => setFormData({ ...formData, remindDaysBefore: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ex: 2"
              />
              <div className="flex items-center px-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-muted-foreground">
                dia(s) antes
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Começa a exibir o lembrete no dashboard e a notificar no celular N dias antes do evento.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Repete</label>
            <select
              value={formData.recurrenceRule}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {RECURRENCE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </select>
          </div>

          {isCustom && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">A cada</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={formData.recurrenceInterval}
                  onChange={(e) => setFormData({ ...formData, recurrenceInterval: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Unidade</label>
                <select
                  value={formData.recurrenceUnit}
                  onChange={(e) => setFormData({ ...formData, recurrenceUnit: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {RECURRENCE_UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {formData.recurrenceRule && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Data fim da recorrência (opcional)
              </label>
              <input
                type="date"
                value={formData.recurrenceEndAt}
                onChange={(e) => setFormData({ ...formData, recurrenceEndAt: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md shadow-primary/30"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar Evento'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}