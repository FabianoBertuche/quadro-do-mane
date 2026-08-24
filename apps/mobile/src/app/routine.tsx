import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api, apiErrorMessage } from '@/lib/api';
import { RoutineItem } from '@/lib/types';
import { colors } from '@/theme/colors';
import { Loading, ErrorState } from '@/components/ui';

export default function RoutineScreen() {
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<RoutineItem[]>('/daily-routine');
      setItems(res.data.filter((i) => i.isActive));
    } catch {
      setError('Não foi possível carregar sua rotina.');
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

  const toggleComplete = async (item: RoutineItem) => {
    const doneToday = (item.logs?.length ?? 0) > 0;
    // v1: marca conclusão; desmarcar não é suportado pela API (apenas complete)
    if (doneToday) return;
    setItems((prev) =>
      prev.map((x) =>
        x.id === item.id
          ? { ...x, logs: [{ id: 'optimistic', completedAt: new Date().toISOString() }] }
          : x,
      ),
    );
    try {
      await api.patch(`/daily-routine/${item.id}/complete`, {});
    } catch (e) {
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, logs: [] } : x)));
      Alert.alert('Erro', apiErrorMessage(e, 'Não foi possível concluir o item.'));
    }
  };

  const createItem = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await api.post('/daily-routine', {
        title: title.trim(),
        description: undefined,
        scheduledTime: /^\d{2}:\d{2}$/.test(time.trim()) ? time.trim() : undefined,
      });
      setTitle('');
      setTime('');
      setShowForm(false);
      await load();
    } catch (e) {
      Alert.alert('Erro', apiErrorMessage(e, 'Não foi possível criar o item.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Carregando rotina..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const done = items.filter((i) => (i.logs?.length ?? 0) > 0).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Rotina Diária</Text>
          <Text style={styles.subtitle}>{done}/{items.length} concluída(s) hoje</Text>
        </View>
        <Pressable onPress={() => setShowForm((v) => !v)} hitSlop={8}>
          <Feather name={showForm ? 'x' : 'plus'} size={20} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>

      {showForm ? (
        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            placeholder="Novo item (ex.: Revisar e-mails)"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="08:00"
              placeholderTextColor={colors.mutedForeground}
              value={time}
              onChangeText={setTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <Pressable
              onPress={() => void createItem()}
              disabled={!title.trim() || saving}
              style={[styles.addBtn, (!title.trim() || saving) && styles.disabled]}
            >
              <Text style={styles.addBtnText}>Adicionar</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
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
        ListEmptyComponent={<Text style={styles.empty}>Nenhum item na sua rotina.</Text>}
        renderItem={({ item }) => {
          const doneToday = (item.logs?.length ?? 0) > 0;
          return (
            <Pressable
              onPress={() => void toggleComplete(item)}
              disabled={doneToday}
              style={({ pressed }) => [
                styles.item,
                doneToday && styles.itemDone,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.checkbox, doneToday && styles.checkboxDone]}>
                {doneToday ? (
                  <Feather name="check" size={14} color="#fff" />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, doneToday && styles.itemTitleDone]}>
                  {item.title}
                </Text>
                {!!item.description && (
                  <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
                )}
              </View>
              {item.scheduledTime ? (
                <Text style={styles.time}>{item.scheduledTime}</Text>
              ) : null}
            </Pressable>
          );
        }}
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
  barBg: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.muted,
    overflow: 'hidden',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  barFill: { height: '100%', backgroundColor: colors.success, borderRadius: 4 },
  formCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.foreground,
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.5 },
  list: { padding: 20, paddingTop: 4, paddingBottom: 40, gap: 10 },
  empty: { color: colors.mutedForeground, textAlign: 'center', marginTop: 40 },
  pressed: { opacity: 0.75 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  itemDone: { opacity: 0.55 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  itemTitle: { color: colors.foreground, fontSize: 14.5, fontWeight: '600' },
  itemTitleDone: { textDecorationLine: 'line-through', color: colors.mutedForeground },
  itemDesc: { color: colors.mutedForeground, fontSize: 12.5, marginTop: 2 },
  time: { color: colors.sidebarMuted, fontSize: 13, fontWeight: '700' },
});
