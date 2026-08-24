import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { api, apiErrorMessage } from '@/lib/api';
import { Collaborator } from '@/lib/types';
import { useEffect } from 'react';
import { OptionChips, Loading } from '@/components/ui';
import { colors } from '@/theme/colors';

export default function TeamCreateScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState<string | null>(null);
  const [people, setPeople] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Collaborator[]>('/users')
      .then((u) => setPeople(u.data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await api.post('/teams', {
        name: name.trim(),
        description: description.trim() || undefined,
        managerTenantUserId: managerId ?? undefined,
      });
      router.back();
    } catch (e) {
      Alert.alert('Erro', apiErrorMessage(e, 'Não foi possível criar a equipe.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Carregando..." />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.cancel}>Cancelar</Text>
        </Pressable>
        <Text style={styles.title}>Nova equipe</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nome *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: Comercial"
          placeholderTextColor={colors.mutedForeground}
          value={name}
          onChangeText={setName}
          editable={!saving}
        />
        <Text style={styles.label}>Descrição</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Objetivo da equipe..."
          placeholderTextColor={colors.mutedForeground}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          editable={!saving}
        />
        <Text style={styles.label}>Gestor</Text>
        <OptionChips
          options={[
            { id: '__none__', name: 'Sem gestor' },
            ...people.map((c) => ({ id: c.id, name: c.user.name })),
          ]}
          valueId={managerId}
          onSelect={(v) => setManagerId(v === '__none__' ? null : v)}
        />

        <Pressable
          onPress={() => void save()}
          disabled={!name.trim() || saving}
          style={[styles.saveBtn, (!name.trim() || saving) && styles.disabled]}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.saveText}>Criar equipe</Text>
          )}
        </Pressable>
      </ScrollView>
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
  label: {
    color: colors.sidebarText,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 18,
  },
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
  saveBtn: {
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  saveText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' },
});
