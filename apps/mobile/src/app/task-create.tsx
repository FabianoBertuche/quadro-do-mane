import { useCallback, useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, apiErrorMessage } from '@/lib/api';
import { Project, TaskStatus, TaskPriority, Collaborator } from '@/lib/types';
import { colors } from '@/theme/colors';
import { OptionChips } from '@/components/ui';

export default function TaskCreateScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [priorities, setPriorities] = useState<TaskPriority[]>([]);
  const [people, setPeople] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState<string | null>(null);
  const [priorityId, setPriorityId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);

  const loadRefs = useCallback(async () => {
    try {
      const [p, s, pr, u] = await Promise.all([
        api.get<Project[]>('/projects'),
        api.get<TaskStatus[]>('/tasks/statuses'),
        api.get<TaskPriority[]>('/tasks/priorities'),
        api.get<Collaborator[]>('/users'),
      ]);
      setProjects(p.data);
      setStatuses(s.data);
      setPriorities(pr.data);
      setPeople(u.data);
      setStatusId(s.data.find((x) => x.isDefault)?.id ?? s.data[0]?.id ?? null);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os dados do formulário.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  const save = async () => {
    if (!projectId || !title.trim() || !statusId) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/tasks', {
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        statusId,
        priorityId: priorityId ?? undefined,
        assigneeTenantUserId: assigneeId ?? undefined,
      });
      router.back();
    } catch (e) {
      setError(apiErrorMessage(e, 'Não foi possível criar a tarefa.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingFull />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.cancel}>Cancelar</Text>
        </Pressable>
        <Text style={styles.title}>Nova tarefa</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Tarefa pertence ao projeto *</Text>
        <OptionChips
          options={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
          valueId={projectId}
          onSelect={setProjectId}
        />
        {projects.length === 0 ? (
          <Text style={styles.hint}>Crie um projeto antes de adicionar tarefas.</Text>
        ) : null}

        <Text style={styles.label}>Título *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: Revisar contrato"
          placeholderTextColor={colors.mutedForeground}
          value={title}
          onChangeText={setTitle}
          editable={!saving}
        />

        <Text style={styles.label}>Descrição</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Detalhes da tarefa..."
          placeholderTextColor={colors.mutedForeground}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          editable={!saving}
        />

        <Text style={styles.label}>Status *</Text>
        <OptionChips
          options={statuses.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
          valueId={statusId}
          onSelect={setStatusId}
        />

        <Text style={styles.label}>Prioridade</Text>
        <OptionChips
          options={priorities.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
          valueId={priorityId}
          onSelect={setPriorityId}
        />

        <Text style={styles.label}>Responsável</Text>
        <OptionChips
          options={[
            { id: '__none__', name: 'Sem responsável' },
            ...people.map((c) => ({ id: c.id, name: c.user.name })),
          ]}
          valueId={assigneeId}
          onSelect={(v) => setAssigneeId(v === '__none__' ? null : v)}
        />

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={save}
          disabled={!projectId || !title.trim() || !statusId || saving}
          style={[
            styles.saveBtn,
            (!projectId || !title.trim() || !statusId || saving) && styles.disabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.saveText}>Criar tarefa</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingFull() {
  return (
    <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: 1,
  },
  cancel: { color: colors.mutedForeground, fontSize: 14, width: 60 },
  title: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  scroll: { padding: 20 },
  label: { color: colors.sidebarText, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 18 },
  hint: { color: colors.warning, fontSize: 12, marginTop: 6 },
  input: {
    backgroundColor: colors.inputBg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.foreground,
    fontSize: 15,
  },
  textarea: { minHeight: 90, paddingTop: 12 },
  errorBox: {
    marginTop: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: colors.error, fontSize: 13 },
  saveBtn: {
    marginTop: 26,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  saveText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' },
});
