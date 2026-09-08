'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/lib/auth';

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

const SAO_PAULO_OFFSET = '-03:00';
const toSaoPauloIso = (value: string) => new Date(`${value}:00${SAO_PAULO_OFFSET}`).toISOString();
const saoPauloMonth = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric',
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value) - 1,
  };
};
const monthBoundary = (year: number, month: number) =>
  new Date(`${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00${SAO_PAULO_OFFSET}`).toISOString();

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(saoPauloMonth);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<CalendarFormData>(emptyForm);
  const [submitError, setSubmitError] = useState('');
  const [creationMessage, setCreationMessage] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedTenantUserId, setSelectedTenantUserId] = useState('');
  const role = useAuthStore((state) => state.role);
  const isAdmin = role === 'admin';

  const { year, month } = currentDate;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const startDate = monthBoundary(year, month);
  const endDate = monthBoundary(year, month + 1);

  const { data: events } = useQuery({
    queryKey: ['events', year, month, selectedTenantUserId],
    queryFn: () => api.get('/events', {
      params: { startDate, endDate, ...(isAdmin && selectedTenantUserId ? { tenantUserId: selectedTenantUserId } : {}) },
    }).then((r) => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users?active=true').then((r) => r.data),
    enabled: isModalOpen,
  });

  const { data: calendarUsers } = useQuery({
    queryKey: ['users', 'calendar-filter'],
    queryFn: () => api.get('/users?active=true').then((r) => r.data),
    enabled: isAdmin,
  });

  const { data: selectedEvent } = useQuery({
    queryKey: ['event', selectedEventId],
    queryFn: () => api.get(`/events/${selectedEventId}`).then((r) => r.data),
    enabled: !!selectedEventId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CalendarFormData) => {
      const payload: any = {
        title: data.title,
        description: data.description || undefined,
        startAt: toSaoPauloIso(data.startAt),
        endAt: toSaoPauloIso(data.endAt),
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
          payload.recurrenceEndAt = new Date(`${data.recurrenceEndAt}T23:59:59${SAO_PAULO_OFFSET}`).toISOString();
        }
      }
      return api.post('/events', payload);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      const count = response.data?.count;
      setCreationMessage(count
        ? `Série criada com ${count} ocorrência${count === 1 ? '' : 's'}. Navegue pelos meses para visualizá-las.`
        : 'Evento criado com sucesso.');
      setIsModalOpen(false);
      setFormData(emptyForm);
      setSubmitError('');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message;
      setSubmitError(
        Array.isArray(msg) ? msg.join('. ') : (msg || 'Não foi possível criar o evento. Verifique os dados e tente novamente.'),
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    const start = new Date(`${formData.startAt}:00${SAO_PAULO_OFFSET}`);
    const end = new Date(`${formData.endAt}:00${SAO_PAULO_OFFSET}`);
    if (end <= start) {
      setSubmitError('A data final do evento deve ser posterior à data de início.');
      return;
    }
    if (formData.recurrenceRule && formData.recurrenceEndAt) {
      const recEnd = new Date(`${formData.recurrenceEndAt}T23:59:59${SAO_PAULO_OFFSET}`);
      if (recEnd < start) {
        setSubmitError('A "Data fim da recorrência" deve ser igual ou posterior à data de início do evento.');
        return;
      }
    }
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

  const getEventsForDay = (day: number) => {
    const dayStart = new Date(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00${SAO_PAULO_OFFSET}`);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    // No grid mensal, uma ocorrência aparece apenas no dia em que começa.
    // Isso evita que eventos longos ocultem os demais dias da recorrência.
    return (events || []).filter((event: any) => new Date(event.startAt) >= dayStart && new Date(event.startAt) < dayEnd);
  };

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const prev = () => {
    const date = new Date(year, month - 1, 1);
    setCurrentDate({ year: date.getFullYear(), month: date.getMonth() });
  };
  const next = () => {
    const date = new Date(year, month + 1, 1);
    setCurrentDate({ year: date.getFullYear(), month: date.getMonth() });
  };

  const today = saoPauloMonth();
  const todayDay = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', day: 'numeric' }).format(new Date()));
  const isToday = (day: number) => todayDay === day && today.month === month && today.year === year;
  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];
  const formatEventDate = (value?: string) => value && new Date(value).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  });
  const openEvent = (id: string) => {
    setSelectedDay(null);
    setSelectedEventId(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Calendário</h1>
          <p className="text-muted-foreground mt-1">Eventos e compromissos</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <select
              value={selectedTenantUserId}
              onChange={(e) => setSelectedTenantUserId(e.target.value)}
              className="max-w-52 px-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Selecionar calendário do colaborador"
            >
              <option value="">Meu calendário</option>
              {(calendarUsers || []).map((user: any) => (
                <option key={user.id} value={user.id}>{user.user?.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => {
              setSubmitError('');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-600 transition-colors shadow-lg shadow-primary/30"
          >
            <Plus className="w-4 h-4" /> Novo Evento
          </button>
        </div>
      </div>

      {creationMessage && (
        <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {creationMessage}
        </div>
      )}

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
              <div
                key={day}
                onClick={() => dayEvents.length > 0 && setSelectedDay(day)}
                className={`bg-card min-h-[80px] p-1.5 ${dayRing} ${dayEvents.length > 0 ? 'cursor-pointer hover:bg-muted/40 transition-colors' : ''}`}
                title={dayEvents.length > 0 ? `Ver ${dayEvents.length} evento(s)` : undefined}
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${isToday(day) ? 'bg-primary text-white' : ''}`}>
                  {day}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((event: any) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEvent(event.id); }}
                      className="block w-full text-left text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate hover:bg-primary/20"
                    >
                      {event.title}
                    </button>
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

      <Modal
        isOpen={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? `Eventos de ${String(selectedDay).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}` : 'Eventos'}
      >
        <div className="space-y-2">
          {selectedDayEvents.map((event: any) => (
            <button
              key={event.id}
              type="button"
              onClick={() => openEvent(event.id)}
              className="w-full text-left rounded-xl border border-border bg-muted/40 p-3 hover:bg-muted transition-colors"
            >
              <div className="font-medium text-sm">{event.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{formatEventDate(event.startAt)}</div>
            </button>
          ))}
        </div>
      </Modal>

      <Modal isOpen={!!selectedEventId} onClose={() => setSelectedEventId(null)} title="Detalhes do evento">
        {selectedEvent ? (
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="text-base font-semibold">{selectedEvent.title}</h3>
              {selectedEvent.description && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selectedEvent.description}</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 rounded-xl bg-muted/50 p-3">
              <div><span className="text-xs text-muted-foreground">Início</span><div>{formatEventDate(selectedEvent.startAt)}</div></div>
              <div><span className="text-xs text-muted-foreground">Fim</span><div>{formatEventDate(selectedEvent.endAt)}</div></div>
              {selectedEvent.assignee && <div><span className="text-xs text-muted-foreground">Responsável</span><div>{selectedEvent.assignee.user?.name}</div></div>}
              {selectedEvent.project && <div><span className="text-xs text-muted-foreground">Projeto</span><div>{selectedEvent.project.name}</div></div>}
              {selectedEvent.task && <div><span className="text-xs text-muted-foreground">Tarefa</span><div>{selectedEvent.task.title}</div></div>}
              {selectedEvent.remindDaysBefore !== null && selectedEvent.remindDaysBefore !== undefined && <div><span className="text-xs text-muted-foreground">Lembrete</span><div>{selectedEvent.remindDaysBefore} dia(s) antes</div></div>}
            </div>
            {selectedEvent.attendees?.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">Participantes</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selectedEvent.attendees.map((attendee: any) => (
                    <span key={attendee.id} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{attendee.tenantUser?.user?.name}</span>
                  ))}
                </div>
              </div>
            )}
            {selectedEvent.recurrenceRule && <div className="text-xs text-muted-foreground">Evento recorrente: a cada {selectedEvent.recurrenceInterval} {selectedEvent.recurrenceUnit}(s), até {formatEventDate(selectedEvent.recurrenceEndAt)}</div>}
          </div>
        ) : <p className="text-sm text-muted-foreground">Carregando detalhes…</p>}
      </Modal>

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
              <label className="block text-sm font-medium text-foreground mb-1.5">Fim desta ocorrência</label>
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
                Repetir até
              </label>
              <input
                type="date"
                required
                value={formData.recurrenceEndAt}
                onChange={(e) => setFormData({ ...formData, recurrenceEndAt: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">Esta data encerra a série; ela não altera a duração de cada ocorrência.</p>
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-600">
              {submitError}
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
