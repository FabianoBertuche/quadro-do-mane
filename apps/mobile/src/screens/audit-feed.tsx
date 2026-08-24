import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api } from '@/lib/api';
import { AuditEntry } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { colors } from '@/theme/colors';
import { Avatar, Loading, ErrorState, Card } from '@/components/ui';

const PERIODS: { label: string; days: number | null }[] = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: 'Tudo', days: null },
];

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

  // filtros
  const [actionFilter, setActionFilter] = useState('');
  const [periodDays, setPeriodDays] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(
    async (action?: string, days?: number | null) => {
      setError(null);
      try {
        const params: Record<string, unknown> = { take: 150 };
        if (action?.trim()) params.action = action.trim();
        if (days != null) {
          const d = new Date();
          d.setDate(d.getDate() - days);
          params.startDate = d.toISOString();
        }
        const res = await api.get<AuditEntry[]>(endpoint, { params });
        setItems(res.data);
      } catch {
        setError('Não foi possível carregar o histórico.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [endpoint],
  );

  useFocusEffect(
    useCallback(() => {
      void load(actionFilter, periodDays);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  if (loading) return <Loading label="Carregando histórico..." />;
  if (error)
    return (
      <ErrorState
        message={error}
        onRetry={() => void load(actionFilter, periodDays)}
      />
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <Pressable onPress={() => setFiltersOpen((v) => !v)} hitSlop={8}>
            <Feather name="filter" size={19} color={colors.primary} />
          </Pressable>
        </View>
        {filtersOpen ? (
          <View style={styles.filters}>
            <TextInput
              style={styles.filterInput}
              placeholder="Filtrar por ação (ex.: TASK_)"
              placeholderTextColor={colors.mutedForeground}
              value={actionFilter}
              onChangeText={setActionFilter}
              autoCapitalize="characters"
            />
            <View style={styles.periodRow}>
              {PERIODS.map((p) => (
                <Pressable
                  key={p.label}
                  onPress={() => setPeriodDays(p.days)}
                  style={[styles.periodChip, periodDays === p.days && styles.periodActive]}
                >
                  <Text
                    style={[
                      styles.periodText,
                      periodDays === p.days && styles.periodTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  setLoading(true);
                  void load(actionFilter, periodDays);
                }}
                style={styles.applyBtn}
              >
                <Text style={styles.applyText}>Aplicar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
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
              void load(actionFilter, periodDays);
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
  filters: { marginTop: 10 },
  filterInput: {
    backgroundColor: colors.inputBg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.foreground,
    fontSize: 13.5,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  periodChip: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.card,
  },
  periodActive: { backgroundColor: `${colors.primary}26`, borderColor: colors.primary },
  periodText: { color: colors.sidebarText, fontSize: 12.5, fontWeight: '600' },
  periodTextActive: { color: colors.primary },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginLeft: 'auto',
  },
  applyText: { color: colors.primaryForeground, fontSize: 12.5, fontWeight: '700' },
  list: { padding: 20, paddingTop: 4, paddingBottom: 40, gap: 10 },
  empty: { color: colors.mutedForeground, textAlign: 'center', marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  action: { color: colors.sidebarText, fontSize: 13.5 },
  target: { color: colors.mutedForeground, fontSize: 12, marginTop: 2 },
  date: { color: colors.sidebarMuted, fontSize: 10.5, maxWidth: 74, textAlign: 'right' },
});
