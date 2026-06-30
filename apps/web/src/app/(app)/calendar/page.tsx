'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startAt: '',
    endAt: '',
  });

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

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const payload = {
        title: data.title,
        description: data.description || undefined,
        startAt: new Date(data.startAt).toISOString(),
        endAt: new Date(data.endAt).toISOString(),
      };
      return api.post('/events', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setIsModalOpen(false);
      setFormData({ title: '', description: '', startAt: '', endAt: '' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
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
            return (
              <div key={day} className={`bg-card min-h-[80px] p-1.5 ${isToday(day) ? 'ring-2 ring-primary ring-inset' : ''}`}>
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
