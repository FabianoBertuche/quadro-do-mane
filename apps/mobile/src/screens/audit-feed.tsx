import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { AuditEntry } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { colors } from '@/theme/colors';
import { Avatar, Loading, ErrorState, Card } from '@/components/ui';

/** Tela genérica de trilha de auditoria/atividades (endpoint parametrizável). */
export function AuditFeedScreen({
  endpoint,
  title,
  subtitle,
}: {
  endpoint: string;
  title: string;
  subtitle: string;
}) {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<AuditEntry[]>(`${endpoint}?take=150`);
      setItems(res.data);
    } catch {
      setError('Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [endpoint]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) return <Loading label="Carregando histórico..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
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
        ListEmptyComponent={<Text style={styles.empty}>Nenhum registro.</Text>}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Avatar name={item.actor?.name ?? 'Sistema'} size={30} />
            <View style={{ flex: 1 }}>
              <Text style={styles.action} numberOfLines={1}>
                <Text style={{ fontWeight: '700' }}>{item.actor?.name ?? 'Sistema'}</Text>
                {' · '}
                {item.action}
              </Text>
              <Text style={styles.target} numberOfLines={1}>
                {item.targetType}
                {item.targetId ? ` · ${item.targetId.slice(0, 8)}…` : ''}
              </Text>
            </View>
            <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
          </Card>
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
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  action: { color: colors.sidebarText, fontSize: 13.5 },
  target: { color: colors.mutedForeground, fontSize: 12, marginTop: 2 },
  date: { color: colors.sidebarMuted, fontSize: 10.5, maxWidth: 74, textAlign: 'right' },
});
