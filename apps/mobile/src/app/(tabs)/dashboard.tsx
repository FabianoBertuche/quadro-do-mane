import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { DashboardOverview } from '@/lib/types';
import { colors } from '@/theme/colors';
import { StatCard, Loading, ErrorState } from '@/components/ui';

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<DashboardOverview>('/dashboard/overview');
      setData(res.data);
    } catch {
      setError('Não foi possível carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Painel</Text>
        <Text style={styles.subtitle}>Visão geral da empresa</Text>
      </View>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
        >
          <View style={styles.grid}>
            <StatCard icon="✅" value={data.completedTasks} label="Concluídas" tone={colors.success} />
            <StatCard icon="🔄" value={data.inProgressTasks} label="Em andamento" />
          </View>
          <View style={styles.grid}>
            <StatCard icon="⏰" value={data.overdueTasks} label="Atrasadas" tone={colors.error} />
            <StatCard icon="📋" value={data.totalTasks} label="Total de tarefas" />
          </View>
          <View style={styles.grid}>
            <StatCard icon="📁" value={data.activeProjects} label="Projetos ativos" />
            <StatCard icon="👥" value={data.totalTeams} label="Equipes" />
          </View>

          <View style={styles.rateCard}>
            <View style={styles.rateHeader}>
              <Text style={styles.rateTitle}>Taxa de conclusão</Text>
              <Text style={styles.rateValue}>{data.completionRate}%</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${Math.min(data.completionRate, 100)}%` }]} />
            </View>
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.mutedForeground, fontSize: 13, marginTop: 2 },
  scroll: { padding: 20, paddingBottom: 40 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  rateCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  rateHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  rateTitle: { color: colors.sidebarText, fontWeight: '600', fontSize: 14 },
  rateValue: { color: colors.success, fontWeight: '800', fontSize: 14 },
  barBg: { height: 8, borderRadius: 4, backgroundColor: colors.muted, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.success, borderRadius: 4 },
});
