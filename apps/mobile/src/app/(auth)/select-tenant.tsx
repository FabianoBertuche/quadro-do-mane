import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { colors } from '@/theme/colors';

interface TenantOption {
  id: string;
  name: string;
}

/**
 * Seleção de empresa (tenant). No fluxo atual o backend auto-seleciona o
 * tenant no login; esta tela existe para paridade com a web e uso futuro
 * (a lista chega via parâmetro `tenants` codificado em JSON).
 */
export default function SelectTenantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tenants?: string }>();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  let tenants: TenantOption[] = [];
  try {
    const parsed = params.tenants ? JSON.parse(params.tenants) : [];
    if (Array.isArray(parsed)) tenants = parsed;
  } catch {
    tenants = [];
  }

  const select = async (tenantId: string) => {
    setError(null);
    setLoading(tenantId);
    try {
      const res = await api.post('/auth/select-tenant', { tenantId });
      useAuthStore.getState().setSession(res.data);
      router.replace('/dashboard');
    } catch (e) {
      setError(apiErrorMessage(e, 'Não foi possível selecionar a empresa.'));
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Escolha a empresa</Text>
        <Text style={styles.subtitle}>Selecione com qual empresa deseja acessar</Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {tenants.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Nenhuma empresa disponível para seleção.
            </Text>
          </View>
        ) : (
          tenants.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => select(t.id)}
              disabled={!!loading}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
              ]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{t.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
              </View>
              <Text style={styles.itemName} numberOfLines={1}>{t.name}</Text>
              {loading === t.id ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24 },
  title: { color: colors.foreground, fontSize: 22, fontWeight: '700', marginTop: 24 },
  subtitle: { color: colors.mutedForeground, fontSize: 14, marginTop: 6, marginBottom: 24 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: colors.error, fontSize: 13 },
  emptyBox: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  emptyText: { color: colors.mutedForeground, fontSize: 14, textAlign: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  itemPressed: { opacity: 0.8 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 16 },
  itemName: { flex: 1, color: colors.foreground, fontSize: 15, fontWeight: '600' },
  chevron: { color: colors.mutedForeground, fontSize: 22 },
});
