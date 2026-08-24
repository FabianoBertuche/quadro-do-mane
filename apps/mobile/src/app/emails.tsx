import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api } from '@/lib/api';
import { EmailMessage } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { colors } from '@/theme/colors';
import { Avatar, Loading, ErrorState } from '@/components/ui';

export default function EmailsScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<EmailMessage[]>('/emails/messages', {
        params: { folder: 'INBOX' },
      });
      setMessages(res.data);
    } catch {
      setError('Não foi possível carregar a caixa de entrada. Verifique as configurações de e-mail.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) return <Loading label="Carregando caixa de entrada..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>E-mail</Text>
        <Text style={styles.subtitle}>{messages.length} mensagem(ns) na caixa de entrada</Text>
      </View>
      <FlatList
        data={messages}
        keyExtractor={(m) => String(m.uid)}
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
        ListEmptyComponent={<Text style={styles.empty}>Caixa de entrada vazia.</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/email/${item.uid}`)}
            style={({ pressed }) => [
              styles.card,
              !item.seen && styles.cardUnread,
              pressed && styles.pressed,
            ]}
          >
            <Avatar name={item.from ?? '@'} size={38} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text
                  style={[styles.from, !item.seen && styles.unreadText]}
                  numberOfLines={1}
                >
                  {item.from ?? item.fromAddress ?? 'Desconhecido'}
                </Text>
                {!item.seen ? <View style={styles.dot} /> : null}
              </View>
              <Text
                style={[styles.subject, !item.seen && styles.unreadText]}
                numberOfLines={2}
              >
                {item.subject}
              </Text>
              <Text style={styles.date}>{formatDateTime(item.date)}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.sidebarMuted} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.mutedForeground, fontSize: 13, marginTop: 2 },
  list: { padding: 20, paddingTop: 4, paddingBottom: 40, gap: 10 },
  empty: { color: colors.mutedForeground, textAlign: 'center', marginTop: 40 },
  pressed: { opacity: 0.75 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardUnread: {
    backgroundColor: '#101B33',
    borderColor: `${colors.primary}44`,
  },
  from: { flex: 1, color: colors.sidebarText, fontSize: 13.5, fontWeight: '600' },
  subject: { color: colors.mutedForeground, fontSize: 13.5, marginTop: 3 },
  unreadText: { color: colors.foreground, fontWeight: '700' },
  date: { color: colors.sidebarMuted, fontSize: 10.5, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
