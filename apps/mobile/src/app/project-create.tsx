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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, apiErrorMessage } from '@/lib/api';
import { colors } from '@/theme/colors';

const PROJECT_COLORS = ['#5B5FEF', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function ProjectCreateScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/projects', {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
      router.back();
    } catch (e) {
      setError(apiErrorMessage(e, 'Não foi possível criar o projeto.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.cancel}>Cancelar</Text>
        </Pressable>
        <Text style={styles.title}>Novo projeto</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nome *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: Redesign do site"
          placeholderTextColor={colors.mutedForeground}
          value={name}
          onChangeText={setName}
          editable={!saving}
        />

        <Text style={styles.label}>Descrição</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Objetivo do projeto..."
          placeholderTextColor={colors.mutedForeground}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!saving}
        />

        <Text style={styles.label}>Cor</Text>
        <View style={styles.colorsRow}>
          {PROJECT_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorActive]}
            >
              {color === c ? <Text style={styles.colorCheck}>✓</Text> : null}
            </Pressable>
          ))}
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={save}
          disabled={!name.trim() || saving}
          style={[styles.saveBtn, (!name.trim() || saving) && styles.disabled]}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.saveText}>Criar projeto</Text>
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
  label: { color: colors.sidebarText, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
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
  textarea: { minHeight: 100, paddingTop: 12 },
  colorsRow: { flexDirection: 'row', gap: 12 },
  colorDot: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorActive: { borderWidth: 2.5, borderColor: colors.foreground },
  colorCheck: { color: '#fff', fontWeight: '800' },
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
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  saveText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' },
});
