import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api, apiErrorMessage } from '@/lib/api';
import { Task, TaskStatus, TaskPriority, TaskComment } from '@/lib/types';
import { can } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';
import { colors } from '@/theme/colors';
import { Avatar, Chip, Loading, ErrorState, OptionChips } from '@/components/ui';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [priorities, setPriorities] = useState<TaskPriority[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [t, s, p, c] = await Promise.all([
        api.get<Task>(`/tasks/${id}`),
        api.get<TaskStatus[]>('/tasks/statuses'),
        api.get<TaskPriority[]>('/tasks/priorities'),
        api.get<TaskComment[]>(`/tasks/${id}/comments`),
      ]);
      setTask(t.data);
      setStatuses(s.data);
      setPriorities(p.data);
      setComments(c.data);
    } catch {
      setError('Não foi possível carregar a tarefa.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const changeStatus = async (statusId: string) => {
    if (!task) return;
    const prev = task;
    setTask({ ...task, statusId, status: statuses.find((s) => s.id === statusId) });
    try {
      await api.patch(`/tasks/${task.id}/status`, { statusId });
    } catch {
      setTask(prev);
      Alert.alert('Erro', 'Não foi possível alterar o status.');
    }
  };

  const changePriority = async (priorityId: string) => {
    if (!task || !can('tasks.change_priority')) return;
    const prev = task;
    setTask({ ...task, priorityId, priority: priorities.find((p) => p.id === priorityId) });
    try {
      await api.patch(`/tasks/${task.id}/priority`, { priorityId });
    } catch {
      setTask(prev);
      Alert.alert('Erro', 'Não foi possível alterar a prioridade.');
    }
  };

  const addComment = async () => {
    if (!task || !comment.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await api.post(`/tasks/${task.id}/comments`, { content: comment.trim() });
      setComment('');
      const c = await api.get<TaskComment[]>(`/tasks/${task.id}/comments`);
      setComments(c.data);
    } catch (e) {
      Alert.alert('Erro', apiErrorMessage(e, 'Não foi possível comentar.'));
    } finally {
      setSendingComment(false);
    }
  };

  const remove = () =>
    Alert.alert('Excluir tarefa', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/tasks/${task!.id}`);
            router.back();
          } catch {
            Alert.alert('Erro', 'Não foi possível excluir.');
          }
        },
      },
    ]);

  if (loading) return <Loading label="Carregando tarefa..." />;
  if (error || !task)
    return <ErrorState message={error ?? 'Tarefa não encontrada.'} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={styles.topTitle}>Detalhe da tarefa</Text>
        {can('tasks.delete') ? (
          <Pressable onPress={remove} hitSlop={10}>
            <Feather name="trash-2" size={20} color={colors.error} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{task.title}</Text>

        {!!task.description ? (
          <Text style={styles.desc}>{task.description}</Text>
        ) : null}

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <OptionChips
            options={statuses}
            valueId={task.statusId}
            onSelect={(sid) => void changeStatus(sid)}
          />
        </View>

        {/* Prioridade */}
        {can('tasks.change_priority') ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prioridade</Text>
            <OptionChips
              options={priorities}
              valueId={task.priorityId}
              onSelect={(pid) => void changePriority(pid)}
            />
          </View>
        ) : task.priority ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prioridade</Text>
            <Chip label={task.priority.name} color={task.priority.color} filled />
          </View>
        ) : null}

        {/* Metadados */}
        <View style={styles.metaCard}>
          <MetaRow icon="folder" label="Projeto" value={task.project?.name ?? '—'} />
          <MetaRow
            icon="user"
            label="Responsável"
            value={task.assignee?.user?.name ?? 'Não atribuída'}
          />
          <MetaRow icon="calendar" label="Prazo" value={formatDateTime(task.dueDate)} />
        </View>

        {/* Comentários */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comentários ({comments.length})</Text>

          {can('tasks.comment') ? (
            <View style={styles.commentBox}>
              <TextInput
                style={styles.commentInput}
                placeholder="Escreva um comentário..."
                placeholderTextColor={colors.mutedForeground}
                value={comment}
                onChangeText={setComment}
                multiline
                editable={!sendingComment}
              />
              <Pressable
                onPress={() => void addComment()}
                disabled={!comment.trim() || sendingComment}
                style={[styles.sendBtn, (!comment.trim() || sendingComment) && styles.disabled]}
              >
                {sendingComment ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="send" size={15} color={colors.primaryForeground} />
                )}
              </Pressable>
            </View>
          ) : null}

          {[...comments].reverse().map((c) => (
            <View key={c.id} style={styles.commentCard}>
              <Avatar name={c.author?.user?.name ?? '?'} size={30} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Text style={styles.commentAuthor}>{c.author?.user?.name ?? 'Usuário'}</Text>
                  <Text style={styles.commentDate}>{formatDateTime(c.createdAt)}</Text>
                </View>
                <Text style={styles.commentContent}>{c.content}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Feather name={icon} size={15} color={colors.mutedForeground} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
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
  scroll: { padding: 20, paddingBottom: 40 },
  title: { color: colors.foreground, fontSize: 21, fontWeight: '800', lineHeight: 28 },
  desc: { color: colors.mutedForeground, fontSize: 14, marginTop: 8, lineHeight: 20 },
  section: { marginTop: 22 },
  sectionTitle: {
    color: colors.sidebarText,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaCard: {
    marginTop: 22,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  metaLabel: { color: colors.mutedForeground, fontSize: 13, width: 90 },
  metaValue: { flex: 1, color: colors.sidebarText, fontSize: 13.5, fontWeight: '600', textAlign: 'right' },
  commentBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 14,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 42,
    maxHeight: 120,
    color: colors.foreground,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  commentCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  commentAuthor: { color: colors.sidebarText, fontWeight: '700', fontSize: 13 },
  commentDate: { color: colors.sidebarMuted, fontSize: 11 },
  commentContent: { color: colors.mutedForeground, fontSize: 13.5, marginTop: 4, lineHeight: 19 },
});
