import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api, apiErrorMessage } from '@/lib/api';
import { useLoadOnMountAndFocus } from '@/lib/use-load-on-mount-and-focus';
import {
  DashboardOverview,
  EventReminder,
  DashboardRoutineItem,
  DailyRoutineSummary,
  Task,
} from '@/lib/types';
import { useAuthStore } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { reminderWhenLabel } from '@/lib/dashboard';
import { colors } from '@/theme/colors';
import { StatCard, Loading, ErrorState } from '@/components/ui';

const SECTION_LIST_MAX = 220;

export default function DashboardScreen() {
  const router = useRouter();
  const tenantUserId = useAuthStore((s) => s.tenantUserId);
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [reminders, setReminders] = useState<EventReminder[]>([]);
  const [routineItems, setRoutineItems] = useState<DashboardRoutineItem[]>([]);
  const [routineSummary, setRoutineSummary] = useState<DailyRoutineSummary | null>(null);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<DashboardOverview>('/dashboard/overview');
      setData(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Não foi possível carregar o painel.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSections = useCallback(() => {
    if (can('calendar.view')) {
      api
        .get<{ reminders: EventReminder[] }>('/events/reminders')
        .then((r) => setReminders(r.data.reminders))
        .catch(() => setReminders([]));
    }
    api
      .get<DashboardRoutineItem[]>('/dashboard/daily-routine-items')
      .then((r) => setRoutineItems(r.data))
      .catch(() => setRoutineItems([]));
    api
      .get<DailyRoutineSummary>('/dashboard/daily-routine-summary')
      .then((r) => setRoutineSummary(r.data))
      .catch(() => setRoutineSummary(null));
    api
      .get<Task[]>('/tasks', { params: { overdue: true } })
      .then((r) => setOverdueTasks(r.data))
      .catch(() => setOverdueTasks([]));
  }, []);

  useLoadOnMountAndFocus(
    useCallback(() => {
      void load();
      loadSections();
    }, [load, loadSections]),
  );

  const overdueRoutines =
    routineSummary?.usersWithOverdueTasks?.reduce((sum, u) => sum + u.overdueCount, 0) ?? 0;

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
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                void load();
                loadSections();
              }}
              tintColor={colors.primary}
            />
          }
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

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="alert-triangle" size={15} color={colors.error} />
              <Text style={[styles.sectionTitle, { color: colors.error }]}>
                Atenção: Itens Atrasados
              </Text>
            </View>
            {overdueTasks.length === 0 && overdueRoutines === 0 ? (
              <Text style={styles.sectionEmpty}>Nenhum item atrasado.</Text>
            ) : (
              <ScrollView style={{ maxHeight: SECTION_LIST_MAX }} showsVerticalScrollIndicator>
                {overdueRoutines > 0 ? (
                  <View style={styles.row}>
                    <Feather name="repeat" size={15} color={colors.error} />
                    <Text style={styles.rowTitle}>
                      {overdueRoutines} rotina(s) diária(s) pendente(s) sem registro
                    </Text>
                  </View>
                ) : null}
                {overdueTasks.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => router.push(`/task/${t.id}`)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Feather name="clock" size={15} color={colors.error} />
                    <Text style={styles.rowTitle} numberOfLines={2}>{t.title}</Text>
                    {t.dueDate ? (
                      <Text style={[styles.rowMeta, styles.rowMetaDanger]}>{formatDate(t.dueDate)}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          {can('calendar.view') ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="bell" size={15} color={colors.primary} />
                <Text style={styles.sectionTitle}>Lembretes do Calendário</Text>
              </View>
              {reminders.length === 0 ? (
                <Text style={styles.sectionEmpty}>Nenhum lembrete próximo.</Text>
              ) : (
                <ScrollView style={{ maxHeight: SECTION_LIST_MAX }} showsVerticalScrollIndicator>
                  {reminders.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => router.push('/calendar')}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                      <Feather name="calendar" size={15} color={colors.mutedForeground} />
                      <Text style={styles.rowTitle} numberOfLines={2}>{r.title}</Text>
                      <View style={styles.rowRight}>
                        <Text style={[styles.rowMeta, styles.rowMetaAccent]}>
                          {reminderWhenLabel(r.daysLeft)}
                        </Text>
                        <Text style={styles.rowMeta}> {formatDate(r.startAt)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="repeat" size={15} color={colors.success} />
              <Text style={styles.sectionTitle}>Rotinas diárias de hoje</Text>
            </View>
            {routineItems.length === 0 ? (
              <Text style={styles.sectionEmpty}>Nenhuma rotina para hoje.</Text>
            ) : (
              <ScrollView style={{ maxHeight: SECTION_LIST_MAX }} showsVerticalScrollIndicator>
                {routineItems.map((item) => {
                  const isMine = tenantUserId != null && item.assignedUserId === tenantUserId;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push('/routine')}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                      <View style={[styles.check, item.completedToday && styles.checkDone]}>
                        {item.completedToday ? (
                          <Feather name="check" size={12} color="#fff" />
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, item.completedToday && styles.rowDone]}>
                          {item.title}
                        </Text>
                        {!isMine && item.assignedTo !== 'Sem nome' ? (
                          <Text style={styles.rowSub}>{item.assignedTo}</Text>
                        ) : null}
                      </View>
                      {item.scheduledTime ? (
                        <Text style={styles.rowMeta}>{item.scheduledTime}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
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
  section: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { color: colors.sidebarText, fontWeight: '700', fontSize: 14 },
  sectionEmpty: { color: colors.mutedForeground, fontSize: 13, paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: { flex: 1, color: colors.foreground, fontSize: 13.5, fontWeight: '500' },
  rowSub: { color: colors.mutedForeground, fontSize: 12, marginTop: 1 },
  rowRight: { alignItems: 'flex-end' },
  rowMeta: { color: colors.sidebarMuted, fontSize: 12 },
  rowMetaDanger: { color: colors.error, fontWeight: '700' },
  rowMetaAccent: { color: colors.primary, fontWeight: '700' },
  rowDone: { textDecorationLine: 'line-through', color: colors.mutedForeground },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  pressed: { opacity: 0.7 },
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