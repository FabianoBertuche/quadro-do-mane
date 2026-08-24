import { useCallback, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api } from '@/lib/api';
import { Contact } from '@/lib/types';
import { can } from '@/lib/permissions';
import { colors } from '@/theme/colors';
import { Avatar, Loading, ErrorState } from '@/components/ui';

export default function ContactsScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Contact[]>('/contacts');
      setContacts(res.data);
    } catch {
      setError('Não foi possível carregar os contatos.');
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

  const filtered = contacts.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.email, c.company].some((v) => v?.toLowerCase().includes(q));
  });

  if (loading) return <Loading label="Carregando contatos..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Contatos</Text>
        <Text style={styles.subtitle}>{filtered.length} contato(s)</Text>
      </View>
      {can('contacts.create') ? (
        <Pressable
          onPress={() => router.push('/contact-create')}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Feather name="plus" size={24} color={colors.primaryForeground} />
        </Pressable>
      ) : null}
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome, e-mail, empresa..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={filtered}
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
        ListEmptyComponent={<Text style={styles.empty}>Nenhum contato encontrado.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Avatar name={item.name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <View style={styles.metaCol}>
                {!!item.company && (
                  <View style={styles.metaRow}>
                    <Feather name="briefcase" size={11} color={colors.sidebarMuted} />
                    <Text style={styles.meta} numberOfLines={1}>{item.company}</Text>
                  </View>
                )}
                {!!item.email && (
                  <View style={styles.metaRow}>
                    <Feather name="mail" size={11} color={colors.sidebarMuted} />
                    <Text style={styles.meta} numberOfLines={1}>{item.email}</Text>
                  </View>
                )}
                {!!item.phone && (
                  <View style={styles.metaRow}>
                    <Feather name="phone" size={11} color={colors.sidebarMuted} />
                    <Text style={styles.meta}>{item.phone}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.mutedForeground, fontSize: 13, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 20,
    marginTop: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: colors.foreground, fontSize: 14 },
  list: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: 10 },
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
  name: { color: colors.foreground, fontSize: 14.5, fontWeight: '600', marginBottom: 4 },
  metaCol: { gap: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { color: colors.mutedForeground, fontSize: 12 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabPressed: { opacity: 0.85 },
});
