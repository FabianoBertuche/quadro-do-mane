import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { Collaborator } from '@/lib/types';
import { colors } from '@/theme/colors';
import { Avatar, Chip, Loading, ErrorState } from '@/components/ui';

export default function CollaboratorsScreen() {
  const [people, setPeople] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Collaborator[]>('/users');
      setPeople(res.data);
    } catch {
      setError('Não foi possível carregar os colaboradores.');
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

  if (loading) return <Loading label="Carregando colaboradores..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Colaboradores</Text>
        <Text style={styles.subtitle}>{people.length} pessoa(s)</Text>
      </View>
      <FlatList
        data={people}
        keyExtractor={(c) => c.id}
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
        ListEmptyComponent={<Text style={styles.empty}>Nenhum colaborador encontrado.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Avatar name={item.user.name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.user.name}
                {item.jobTitle ? ` · ${item.jobTitle}` : ''}
              </Text>
              <Text style={styles.email} numberOfLines={1}>{item.user.email}</Text>
            </View>
            <Chip
              label={item.status === 'ACTIVE' ? 'Ativo' : item.status ?? ''}
              color={item.status === 'ACTIVE' ? colors.success : colors.mutedForeground}
            />
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
  list: { padding: 20, paddingTop: 4, paddingBottom: 40, gap: 10 },
  empty: { color: colors.mutedForeground, textAlign: 'center', marginTop: 40 },
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
  name: { color: colors.foreground, fontSize: 14.5, fontWeight: '600' },
  email: { color: colors.mutedForeground, fontSize: 12.5, marginTop: 3 },
});
