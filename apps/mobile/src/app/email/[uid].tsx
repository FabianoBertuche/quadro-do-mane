import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api, apiErrorMessage, API_URL } from '@/lib/api';
import axios from 'axios';
import { useAuthStore } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { colors } from '@/theme/colors';
import { Loading, ErrorState } from '@/components/ui';

interface EmailDetail {
  uid: number | string;
  subject: string;
  from?: string | null;
  fromAddress?: string | null;
  to?: string | null;
  date?: string | null;
  bodyText?: string | null;
}

export default function EmailDetailScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/emails/messages/${uid}`, {
        headers: {
          Authorization: `Bearer ${useAuthStore.getState().accessToken ?? ''}`,
        },
        timeout: 20_000,
      });
      setEmail(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Não foi possível carregar a mensagem.'));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) return <Loading label="Carregando mensagem..." />;
  if (error || !email)
    return <ErrorState message={error ?? 'Mensagem não encontrada.'} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={styles.topTitle}>Mensagem</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subject}>{email.subject}</Text>
        <View style={styles.metaCard}>
          <Meta label="De" value={email.from ? `${email.from}` : email.fromAddress ?? '—'} />
          <Meta label="Para" value={email.to ?? '—'} />
          <Meta label="Data" value={formatDateTime(email.date)} />
        </View>
        <Text style={styles.body}>{email.bodyText || '(sem conteúdo de texto)'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
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
  subject: { color: colors.foreground, fontSize: 19, fontWeight: '800', lineHeight: 26 },
  metaCard: {
    marginTop: 14,
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
    paddingVertical: 9,
  },
  metaLabel: { color: colors.mutedForeground, fontSize: 12.5, width: 40 },
  metaValue: { flex: 1, color: colors.sidebarText, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  body: {
    marginTop: 18,
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 21,
  },
});
