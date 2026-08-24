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
import { colors } from '@/theme/colors';

export default function ContactCreateScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await api.post('/contacts', {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        role: role.trim() || undefined,
      });
      router.back();
    } catch (e) {
      Alert.alert('Erro', apiErrorMessage(e, 'Não foi possível criar o contato.'));
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
        <Text style={styles.title}>Novo contato</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nome *</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome completo"
          placeholderTextColor={colors.mutedForeground}
          value={name}
          onChangeText={setName}
          editable={!saving}
        />
        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={styles.input}
          placeholder="email@exemplo.com"
          placeholderTextColor={colors.mutedForeground}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!saving}
        />
        <Text style={styles.label}>Telefone</Text>
        <TextInput
          style={styles.input}
          placeholder="(00) 00000-0000"
          placeholderTextColor={colors.mutedForeground}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!saving}
        />
        <Text style={styles.label}>Empresa</Text>
        <TextInput
          style={styles.input}
          placeholder="Empresa"
          placeholderTextColor={colors.mutedForeground}
          value={company}
          onChangeText={setCompany}
          editable={!saving}
        />
        <Text style={styles.label}>Cargo</Text>
        <TextInput
          style={styles.input}
          placeholder="Cargo"
          placeholderTextColor={colors.mutedForeground}
          value={role}
          onChangeText={setRole}
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
            <Text style={styles.saveText}>Salvar contato</Text>
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
