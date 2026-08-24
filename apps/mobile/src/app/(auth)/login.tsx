import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { colors } from '@/theme/colors';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email.trim() || !password || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      // O backend auto-seleciona o tenant (único ou Monte Moria) e já
      // devolve a sessão completa: tokens + user + tenant + permissions.
      useAuthStore.getState().setSession(res.data);
      router.replace('/dashboard');
    } catch (e) {
      setError(apiErrorMessage(e, 'Não foi possível entrar. Verifique suas credenciais.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>Q</Text>
            </View>
            <Text style={styles.title}>Quadro do Manê</Text>
            <Text style={styles.subtitle}>Gestão de tarefas e projetos</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="voce@empresa.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              editable={!loading}
            />

            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Sua senha"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                editable={!loading}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={12}
                style={styles.showPass}
              >
                <Text style={styles.showPassText}>{showPassword ? 'ocultar' : 'ver'}</Text>
              </Pressable>
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              onPress={onSubmit}
              disabled={loading || !email.trim() || !password}
              style={({ pressed }) => [
                styles.button,
                (loading || !email.trim() || !password) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.footer}>Monte Moria · Sistema corporativo de gestão</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { color: colors.primaryForeground, fontSize: 28, fontWeight: '800' },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.mutedForeground, fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
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
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 60 },
  showPass: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  showPassText: { color: colors.mutedForeground, fontSize: 13, fontWeight: '600' },
  errorBox: {
    marginTop: 14,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: colors.error, fontSize: 13 },
  button: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' },
  footer: {
    color: colors.mutedForeground,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
  },
});
