import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { DndProvider, Droppable, Draggable } from '@mgcrea/react-native-dnd';
import { api, apiErrorMessage } from '@/lib/api';
import { useLoadOnMountAndFocus } from '@/lib/use-load-on-mount-and-focus';
import { Task, TaskStatus, TaskPriority } from '@/lib/types';
import { can } from '@/lib/permissions';
import { formatDate, isOverdue } from '@/lib/format';
import { resolveKanbanDrop } from '@/lib/kanban-dnd';
import { colors } from '@/theme/colors';
import { Avatar, Chip, Loading, ErrorState, Segmented } from '@/components/ui';

type ViewMode = 'list' | 'kanban';

export default function TasksScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>('list');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [priorities, setPriorities] = useState<TaskPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [t, s, p] = await Promise.all([
        api.get<Task[]>('/tasks'),
        api.get<TaskStatus[]>('/tasks/statuses'),
        api.get<TaskPriority[]>('/tasks/priorities'),
      ]);
      setTasks(t.data);
      setStatuses(s.data);
      setPriorities(p.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Não foi possível carregar as tarefas.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useLoadOnMountAndFocus(load);

  const byStatus = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const s of statuses) map.set(s.id, []);
    for (const t of tasks) {
      if (!map.has(t.statusId)) map.set(t.statusId, []);
      map.get(t.statusId)!.push(t);
    }
    return map;
  }, [tasks, statuses]);

  /** Move tarefa para a coluna alvo (kanban). */
  const moveTaskToStatus = useCallback(
    async (task: Task, targetStatusId: string) => {
      const target = statuses.find((s) => s.id === targetStatusId);
      if (!target || task.statusId === targetStatusId) return;
      // otimista
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, statusId: target.id, status: target } : t)),
      );
      try {
        await api.patch(`/tasks/${task.id}/status`, { statusId: target.id });
      } catch {
        // rollback
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, statusId: task.statusId, status: task.status } : t,
          ),
        );
      }
    },
    [statuses],
  );

  if (loading) return <Loading label="Carregando tarefas..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Tarefas</Text>
          <Text style={styles.subtitle}>{tasks.length} tarefa(s)</Text>
        </View>
        {can('tasks.create') ? (
          <Pressable
            onPress={() => router.push('/task-create')}
            style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.8 }]}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
            <Text style={styles.newBtnText}>Nova</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
        <Segmented<ViewMode>
          options={[
            { value: 'list', label: 'Lista' },
            { value: 'kanban', label: 'Kanban' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </View>

      {mode === 'list' ? (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>Nenhuma tarefa encontrada.</Text>}
          renderItem={({ item }) => (
            <TaskRow
              task={item}
              onPress={() => router.push(`/task/${item.id}`)}
            />
          )}
        />
      ) : (
        <KanbanBoard
          statuses={statuses}
          byStatus={byStatus}
          onTaskPress={(id) => router.push(`/task/${id}`)}
          onTaskDrop={moveTaskToStatus}
        />
      )}
    </SafeAreaView>
  );
}

function TaskRow({ task, onPress }: { task: Task; onPress: () => void }) {
  const overdue = isOverdue(task.dueDate) && task.status?.category !== 'done';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.dot, { backgroundColor: task.status?.color || colors.mutedForeground }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{task.title}</Text>
        <View style={styles.meta}>
          {task.priority ? <Chip label={task.priority.name} color={task.priority.color} /> : null}
          {task.status ? <Chip label={task.status.name} color={task.status.color} /> : null}
          {task.project?.name ? <Chip label={task.project.name} color={task.project.color} /> : null}
          {overdue ? <Chip label="Atrasada" color={colors.error} filled /> : null}
        </View>
      </View>
      <View style={styles.rightCol}>
        {task.assignee?.user?.name ? (
          <Avatar name={task.assignee.user.name} size={26} />
        ) : null}
        {task.dueDate ? (
          <Text style={[styles.due, overdue && styles.dueOverdue]}>{formatDate(task.dueDate)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function KanbanBoard({
  statuses,
  byStatus,
  onTaskPress,
  onTaskDrop,
}: {
  statuses: TaskStatus[];
  byStatus: Map<string, Task[]>;
  onTaskPress: (id: string) => void;
  onTaskDrop: (task: Task, toStatusId: string) => Promise<void>;
}) {
  const dragJustHappened = useRef(false);

  const handleDragEnd = ({
    active,
    over,
  }: {
    active: { id: string | number };
    over: { id: string | number } | null;
  }) => {
    const allTasks = Array.from(byStatus.values()).flat();
    const drop = resolveKanbanDrop(active.id, over?.id ?? null, allTasks);
    if (!drop) return;
    const task = allTasks.find((t) => t.id === drop.taskId);
    if (task) void onTaskDrop(task, drop.targetStatusId);
  };

  return (
    <DndProvider
      activationDelay={200}
      onDragEnd={handleDragEnd}
      onActivation={(next) => {
        dragJustHappened.current = next !== null;
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.board}>
        {statuses.map((status) => {
          const items = byStatus.get(status.id) ?? [];
          const accent = status.color || colors.mutedForeground;
          return (
            <Droppable
              key={status.id}
              id={status.id}
              style={[styles.column, { borderColor: accent }]}
              animatedStyleWorklet={(s, { isActive }) => {
                'worklet';
                return {
                  ...s,
                  borderColor: isActive ? colors.primary : accent,
                  backgroundColor: isActive ? `${colors.primary}15` : colors.card,
                };
              }}
            >
              <View style={styles.colHeader}>
                <View style={[styles.colDot, { backgroundColor: accent }]} />
                <Text style={styles.colTitle}>{status.name}</Text>
                <View style={styles.colCount}>
                  <Text style={styles.colCountText}>{items.length}</Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.colBody}>
                {items.length === 0 ? (
                  <Text style={styles.colEmpty}>—</Text>
                ) : (
                  items.map((task) => (
                    <Draggable
                      key={task.id}
                      id={task.id}
                      activeOpacity={0.92}
                      style={styles.kanbanCard}
                    >
                      <Pressable
                        onPress={() => {
                          if (dragJustHappened.current) {
                            dragJustHappened.current = false;
                            return;
                          }
                          onTaskPress(task.id);
                        }}
                      >
                        <Text style={styles.kanbanTitle} numberOfLines={3}>{task.title}</Text>
                      </Pressable>
                      <View style={styles.kanbanMeta}>
                        {task.priority ? (
                          <Chip label={task.priority.name} color={task.priority.color} />
                        ) : null}
                        {isOverdue(task.dueDate) && status.category !== 'done' ? (
                          <Chip label="Atrasada" color={colors.error} filled />
                        ) : null}
                      </View>
                    </Draggable>
                  ))
                )}
              </ScrollView>
            </Droppable>
          );
        })}
      </ScrollView>
    </DndProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.mutedForeground, fontSize: 13, marginTop: 2 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  newBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  listContent: { padding: 20, paddingTop: 4, paddingBottom: 40, gap: 10 },
  empty: { color: colors.mutedForeground, textAlign: 'center', marginTop: 40 },
  pressed: { opacity: 0.75 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardBody: { flex: 1, gap: 7 },
  cardTitle: { color: colors.foreground, fontSize: 14.5, fontWeight: '600' },
  meta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  rightCol: { alignItems: 'flex-end', gap: 5 },
  due: { color: colors.sidebarMuted, fontSize: 11 },
  dueOverdue: { color: colors.error, fontWeight: '700' },

  board: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  column: {
    width: 272,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    maxHeight: '100%',
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: 1,
  },
  colDot: { width: 9, height: 9, borderRadius: 4.5 },
  colTitle: { flex: 1, color: colors.sidebarText, fontWeight: '700', fontSize: 13.5 },
  colCount: {
    backgroundColor: colors.muted,
    borderRadius: 999,
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: 'center',
  },
  colCountText: { color: colors.mutedForeground, fontSize: 11, fontWeight: '700' },
  colBody: { padding: 10, gap: 10 },
  colEmpty: { color: colors.sidebarMuted, textAlign: 'center', paddingVertical: 18 },
  kanbanCard: {
    backgroundColor: colors.inputBg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  kanbanTitle: { color: colors.foreground, fontSize: 13.5, fontWeight: '600' },
  kanbanMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
});
