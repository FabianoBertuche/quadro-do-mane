import { useEffect, useState } from 'react';
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
import Feather from '@expo/vector-icons/Feather';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { colors } from '@/theme/colors';

interface TenantLink {
  user?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  jobTitle?: string | null;
  department?: string | null;
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = (u: Partial<NonNullable<ReturnType<typeof useAuthStore.getState>['user']>>) =>
    useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, ...u } : s.user }));

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<TenantLink & { phone?: string | null }>('/users/me/tenant-link')
      .then(({ data }) => {
        setPhone(data.user?.phone ?? '');
        setJobTitle(data.jobTitle ?? '');
        setDepartment(data.department ?? '');
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await api.patch('/users/me/tenant-link', {
        name: name.trim(),
        phone: phone.trim() || null,
        jobTitle: jobTitle.trim() || null,
        department: department.trim() || null,
      });
      setUser({ name: name.trim() });
      Alert.alert('Pronto', 'Perfil atualizado.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Erro', apiErrorMessage(e, 'Não foi possível salvar o perfil.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>Editar perfil</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.label}>Nome *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Seu nome"
            placeholderTextColor={colors.mutedForeground}
            editable={!saving}
          />
          <Text style={styles.label}>Telefone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="(00) 00000-0000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            editable={!saving}
          />
          <Text style={styles.label}>Cargo</Text>
          <TextInput
            style={styles.input}
            value={jobTitle}
            onChangeText={setJobTitle}
            placeholder="Ex.: Analista"
            placeholderTextColor={colors.mutedForeground}
            editable={!saving}
          />
          <Text style={styles.label}>Departamento</Text>
          <TextInput
            style={styles.input}
            value={department}
            onChangeText={setDepartment}
            placeholder="Ex.: Operações"
            placeholderTextColor={colors.mutedForeground}
            editable={!saving}
          />

          <Pressable
            onPress={() => void save()}
            disabled={!name.trim() || saving}
            style={[styles.saveBtn, (!name.trim() || saving) && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.saveText}>Salvar alterações</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
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
    paddingVertical: 12,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: 1,
  },
  title: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  email: { color: colors.mutedForeground, fontSize: 13, marginTop: 16 },
  scroll: { padding: 20, paddingTop: 8 },
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
