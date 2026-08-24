import { useCallback, useMemo, useState } from 'react';
import { View, Text, SectionList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api } from '@/lib/api';
import { CalendarEvent } from '@/lib/types';
import { dayLabel, timeLabel } from '@/lib/format';
import { colors } from '@/theme/colors';
import { Loading, ErrorState } from '@/components/ui';

interface Section {
  key: string;
  title: string;
  data: CalendarEvent[];
}

export default function CalendarScreen() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    // janela: 30 dias para trás e 60 para frente
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const end = new Date();
    end.setDate(end.getDate() + 60);
    try {
      const res = await api.get<CalendarEvent[]>('/events', {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
      });
      setEvents(res.data);
    } catch {
      setError('Não foi possível carregar o calendário.');
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

  const sections = useMemo<Section[]>(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = new Date(ev.startAt).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return [...map.entries()]
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([key, data]) => ({ key, title: dayLabel(data[0].startAt), data }));
  }, [events]);

  if (loading) return <Loading label="Carregando eventos..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendário</Text>
        <Text style={styles.subtitle}>{events.length} evento(s) nos próximos meses</Text>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
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
        renderSectionHeader={({ section }) => (
          <Text style={styles.dayHeader}>{section.title}</Text>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum evento no período.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.timeBox}>
              <Text style={styles.time}>{item.allDay ? 'dia todo' : timeLabel(item.startAt)}</Text>
              {!item.allDay ? (
                <Text style={styles.timeEnd}>{timeLabel(item.endAt)}</Text>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.title}</Text>
              {!!item.location && (
                <View style={styles.metaRow}>
                  <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                  <Text style={styles.meta}>{item.location}</Text>
                </View>
              )}
              {!!item.createdBy?.user?.name && (
                <View style={styles.metaRow}>
                  <Feather name="user" size={12} color={colors.mutedForeground} />
                  <Text style={styles.meta}>por {item.createdBy.user.name}</Text>
                </View>
              )}
            </View>
          </View>
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
  list: { padding: 20, paddingTop: 4, paddingBottom: 40 },
  empty: { color: colors.mutedForeground, textAlign: 'center', marginTop: 40 },
  dayHeader: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 10,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  timeBox: { alignItems: 'center', justifyContent: 'flex-start', minWidth: 52 },
  time: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
  timeEnd: { color: colors.sidebarMuted, fontSize: 11, marginTop: 2 },
  name: { color: colors.foreground, fontSize: 14.5, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  meta: { color: colors.mutedForeground, fontSize: 12 },
});
