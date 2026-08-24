import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api } from '@/lib/api';
import { Project, Task } from '@/lib/types';
import { formatDate, isOverdue } from '@/lib/format';
import { colors } from '@/theme/colors';
import { Avatar, Chip, Loading, ErrorState } from '@/components/ui';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [p, t] = await Promise.all([
        api.get<Project>(`/projects/${id}`),
        api.get<Task[]>(`/tasks?projectId=${id}`),
      ]);
      setProject(p.data);
      setTasks(t.data);
    } catch {
      setError('Não foi possível carregar o projeto.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) return <Loading label="Carregando projeto..." />;
  if (error || !project) return <ErrorState message={error ?? 'Projeto não encontrado.'} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={styles.topTitle}>Detalhe do projeto</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
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
        ListHeaderComponent={
          <View style={styles.headerCard}>
            <View style={[styles.colorBar, { backgroundColor: project.color || colors.primary }]} />
            <View style={styles.headerBody}>
              <Text style={styles.name}>{project.name}</Text>
              {!!project.description && (
                <Text style={styles.desc}>{project.description}</Text>
              )}
              <View style={styles.metaRow}>
                {project._count ? <Chip label={`${project._count.tasks} tarefas`} /> : null}
                {project.team?.name ? <Chip label={project.team.name} color={colors.warning} /> : null}
              </View>
              <View style={styles.ownerRow}>
                <Avatar name={project.owner?.user?.name ?? '?'} size={26} />
                <View>
                  <Text style={styles.ownerName}>{project.owner?.user?.name ?? '—'}</Text>
                  <Text style={styles.ownerLabel}>Responsável</Text>
                </View>
                {project.dueDate ? (
                  <Text style={styles.due}>Prazo: {formatDate(project.dueDate)}</Text>
                ) : null}
              </View>
            </View>
          </View>
        }
        ListHeaderComponentStyle={{ marginBottom: 8 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhuma tarefa neste projeto ainda.</Text>
        }
        renderItem={({ item }) => {
          const overdue = isOverdue(item.dueDate) && item.status?.category !== 'done';
          return (
            <Pressable
              onPress={() => router.push(`/task/${item.id}`)}
              style={({ pressed }) => [styles.taskCard, pressed && styles.pressed]}
            >
              <View
                style={[
                  styles.taskDot,
                  { backgroundColor: item.status?.color || colors.mutedForeground },
                ]}
              />
              <View style={styles.taskBody}>
                <Text style={styles.taskTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.taskMeta}>
                  {item.priority ? (
                    <Chip label={item.priority.name} color={item.priority.color} />
                  ) : null}
                  {item.assignee?.user?.name ? (
                    <Text style={styles.metaText}>{item.assignee.user.name}</Text>
                  ) : null}
                  {overdue ? <Chip label="Atrasada" color={colors.error} filled /> : null}
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={colors.sidebarMuted} />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: 1,
  },
  topTitle: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  list: { padding: 20, paddingBottom: 40 },
  headerCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  colorBar: { width: 5 },
  headerBody: { flex: 1, padding: 16, gap: 10 },
  name: { color: colors.foreground, fontSize: 19, fontWeight: '800' },
  desc: { color: colors.mutedForeground, fontSize: 13 },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ownerName: { color: colors.sidebarText, fontSize: 13, fontWeight: '600' },
  ownerLabel: { color: colors.mutedForeground, fontSize: 11 },
  due: { marginLeft: 'auto', color: colors.mutedForeground, fontSize: 12 },
  empty: { color: colors.mutedForeground, textAlign: 'center', marginTop: 32 },
  pressed: { opacity: 0.75 },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  taskDot: { width: 8, height: 8, borderRadius: 4 },
  taskBody: { flex: 1, gap: 6 },
  taskTitle: { color: colors.foreground, fontSize: 14.5, fontWeight: '600' },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaText: { color: colors.mutedForeground, fontSize: 12 },
});
