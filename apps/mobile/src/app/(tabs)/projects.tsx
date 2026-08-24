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
import { Project } from '@/lib/types';
import { can } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { colors } from '@/theme/colors';
import { Avatar, Chip, Loading, ErrorState } from '@/components/ui';

export default function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Project[]>('/projects');
      setProjects(res.data);
    } catch {
      setError('Não foi possível carregar os projetos.');
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

  if (loading) return <Loading label="Carregando projetos..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Projetos</Text>
          <Text style={styles.subtitle}>{projects.length} projeto(s)</Text>
        </View>
        {can('projects.create') ? (
          <Pressable
            onPress={() => router.push('/project-create')}
            style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.8 }]}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
            <Text style={styles.newBtnText}>Novo</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
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
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum projeto encontrado.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/project/${item.id}`)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={[styles.colorBar, { backgroundColor: item.color || colors.primary }]} />
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                {item._count ? (
                  <Chip label={`${item._count.tasks} tarefas`} />
                ) : null}
              </View>
              {!!item.description && (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              )}
              <View style={styles.cardFooter}>
                <Avatar name={item.owner?.user?.name ?? '?'} size={22} />
                <Text style={styles.footerText} numberOfLines={1}>
                  {item.owner?.user?.name ?? 'Sem responsável'}
                  {item.team?.name ? ` · ${item.team.name}` : ''}
                </Text>
                {item.dueDate ? (
                  <Text style={styles.dueText}>até {formatDate(item.dueDate)}</Text>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.mutedForeground, fontSize: 13, marginTop: 2 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  newBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  list: { padding: 20, paddingTop: 4, paddingBottom: 40, gap: 12 },
  empty: { color: colors.mutedForeground, textAlign: 'center', marginTop: 40 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  colorBar: { width: 5 },
  cardBody: { flex: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, color: colors.foreground, fontSize: 16, fontWeight: '700' },
  cardDesc: { color: colors.mutedForeground, fontSize: 13 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerText: { flex: 1, color: colors.mutedForeground, fontSize: 12 },
  dueText: { color: colors.sidebarMuted, fontSize: 11 },
});
