import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api, apiErrorMessage } from '@/lib/api';
import { Project, Task } from '@/lib/types';
import { formatDate, isOverdue } from '@/lib/format';
import { can } from '@/lib/permissions';
import { colors } from '@/theme/colors';
import { Avatar, Chip, Loading, ErrorState } from '@/components/ui';

const DUE_PRESETS: { label: string; days: number | null }[] = [
  { label: 'Hoje', days: 0 },
  { label: '1 semana', days: 7 },
  { label: '2 semanas', days: 14 },
  { label: '1 mês', days: 30 },
  { label: 'Limpar', days: null },
];

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // edição
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDue, setFormDue] = useState<string | null>(null);

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

  const startEdit = () => {
    if (!project) return;
    setFormName(project.name);
    setFormDesc(project.description ?? '');
    setFormDue(project.dueDate ? project.dueDate.slice(0, 10) : null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!project || !formName.trim() || saving) return;
    setSaving(true);
    try {
      await api.patch(`/projects/${project.id}`, {
        name: formName.trim(),
        description: formDesc.trim(),
        dueDate: formDue ? new Date(`${formDue}T12:00:00`).toISOString() : null,
      });
      setEditing(false);
      await load();
    } catch (e) {
      Alert.alert('Erro', apiErrorMessage(e, 'Não foi possível salvar o projeto.'));
    } finally {
      setSaving(false);
    }
  };

  const removeProject = () =>
    Alert.alert(
      'Excluir projeto',
      'O projeto e seus vínculos serão removidos. Essa ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/projects/${project!.id}`);
              router.back();
            } catch (e) {
              Alert.alert('Erro', apiErrorMessage(e, 'Não foi possível excluir o projeto.'));
            }
          },
        },
      ],
    );

  const setDueDays = (days: number | null) => {
    if (days === null) {
      setFormDue(null);
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    setFormDue(d.toISOString().slice(0, 10));
  };

  if (loading) return <Loading label="Carregando projeto..." />;
  if (error || !project) return <ErrorState message={error ?? 'Projeto não encontrado.'} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={styles.topTitle}>Detalhe do projeto</Text>
        <View style={styles.topActions}>
          {can('projects.edit') && !editing ? (
            <Pressable onPress={startEdit} hitSlop={10}>
              <Feather name="edit-2" size={19} color={colors.foreground} />
            </Pressable>
          ) : null}
          {can('projects.delete') && !editing ? (
            <Pressable onPress={removeProject} hitSlop={10}>
              <Feather name="trash-2" size={20} color={colors.error} />
            </Pressable>
          ) : null}
          {!can('projects.edit') && !can('projects.delete') ? (
            <View style={{ width: 24 }} />
          ) : null}
        </View>
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
          editing ? (
            <View style={styles.editCard}>
              <Text style={styles.editLabel}>Nome *</Text>
              <TextInput
                style={styles.editInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="Nome do projeto"
                placeholderTextColor={colors.mutedForeground}
                editable={!saving}
              />
              <Text style={styles.editLabel}>Descrição</Text>
              <TextInput
                style={[styles.editInput, styles.editTextarea]}
                value={formDesc}
                onChangeText={setFormDesc}
                placeholder="Detalhes..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
                editable={!saving}
              />
              <Text style={styles.editLabel}>Prazo</Text>
              <View style={styles.dueRow}>
                {DUE_PRESETS.map((p) => (
                  <Pressable key={p.label} onPress={() => setDueDays(p.days)} style={styles.dueChip}>
                    <Text style={styles.dueChipText}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>
              {!!formDue && <Text style={styles.dueValue}>Prazo: {formatDate(formDue)}</Text>}
              <View style={styles.editActions}>
                <Pressable
                  onPress={() => setEditing(false)}
                  disabled={saving}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={() => void saveEdit()}
                  disabled={!formName.trim() || saving}
                  style={[styles.saveBtn, (!formName.trim() || saving) && styles.disabled]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.saveBtnText}>Salvar</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
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
          )
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
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 16, minWidth: 24 },
  editCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  editLabel: {
    color: colors.sidebarText,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editInput: {
    backgroundColor: colors.inputBg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.foreground,
    fontSize: 14,
  },
  editTextarea: { minHeight: 80 },
  dueRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dueChip: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.inputBg,
  },
  dueChipText: { color: colors.sidebarText, fontSize: 12.5, fontWeight: '600' },
  dueValue: { color: colors.sidebarMuted, fontSize: 12, marginTop: 8 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderColor: colors.cardBorder,
    borderWidth: 1,
  },
  cancelBtnText: { color: colors.mutedForeground, fontSize: 14.5, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: { color: colors.primaryForeground, fontSize: 14.5, fontWeight: '700' },
  disabled: { opacity: 0.5 },
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
