import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { Team } from '@/lib/types';
import { colors } from '@/theme/colors';
import { Avatar, Loading, ErrorState } from '@/components/ui';

export default function TeamsScreen() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Team[]>('/teams');
      setTeams(res.data);
    } catch {
      setError('Não foi possível carregar as equipes.');
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

  if (loading) return <Loading label="Carregando equipes..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Equipes</Text>
        <Text style={styles.subtitle}>{teams.length} equipe(s)</Text>
      </View>
      <FlatList
        data={teams}
        keyExtractor={(t) => t.id}
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
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma equipe encontrada.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {!!item.manager?.user?.name && (
                  <Text style={styles.meta}>Gestor: {item.manager.user.name}</Text>
                )}
              </View>
            </View>
            <View style={styles.membersRow}>
              {(item.members ?? []).slice(0, 5).map((m: any, i: number) => (
                <View key={m?.id ?? i} style={styles.memberAvatar}>
                  <Avatar name={m?.tenantUser?.user?.name ?? '?'} size={26} />
                </View>
              ))}
              <Text style={styles.counts}>
                {item._count?.members ?? 0} membros · {item._count?.projects ?? 0} projetos
              </Text>
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
  list: { padding: 20, paddingTop: 4, paddingBottom: 40, gap: 12 },
  empty: { color: colors.mutedForeground, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.primaryForeground, fontWeight: '800', fontSize: 17 },
  name: { color: colors.foreground, fontSize: 15.5, fontWeight: '700' },
  meta: { color: colors.mutedForeground, fontSize: 12.5, marginTop: 2 },
  membersRow: { flexDirection: 'row', alignItems: 'center' },
  memberAvatar: { marginRight: -7 },
  counts: { marginLeft: 16, color: colors.sidebarMuted, fontSize: 11.5 },
});
