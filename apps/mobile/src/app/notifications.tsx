import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api, apiErrorMessage } from '@/lib/api';
import { AppNotification } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { colors } from '@/theme/colors';
import { Loading, ErrorState, Card } from '@/components/ui';

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  task_assigned: 'user-check',
  task_completed: 'check-circle',
  project_created: 'folder-plus',
  comment: 'message-square',
  default: 'bell',
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<AppNotification[]>('/notifications');
      setItems(res.data);
    } catch {
      setError('Não foi possível carregar as notificações.');
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

  const markRead = async (n: AppNotification) => {
    if (n.isRead) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    try {
      await api.patch(`/notifications/${n.id}/read`);
    } catch {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: false } : x)));
    }
  };

  const readAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    try {
      await api.patch('/notifications/read-all');
    } catch (e) {
      Alert.alert('Erro', apiErrorMessage(e, 'Falha ao marcar todas como lidas.'));
      void load();
    }
  };

  const unread = items.filter((n) => !n.isRead).length;

  if (loading) return <Loading label="Carregando notificações..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Notificações</Text>
          <Text style={styles.subtitle}>{unread} não lida(s)</Text>
        </View>
        {unread > 0 ? (
          <Pressable onPress={() => void readAll()} hitSlop={8}>
            <Text style={styles.readAll}>Marcar todas como lidas</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
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
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma notificação.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => void markRead(item)} style={({ pressed }) => [pressed && styles.pressed]}>
            <Card style={[styles.card, !item.isRead && styles.cardUnread]}>
              <View style={styles.iconBox}>
                <Feather
                  name={ICONS[item.type] ?? ICONS.default}
                  size={17}
                  color={item.isRead ? colors.mutedForeground : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.nTitle, !item.isRead && styles.nTitleUnread]} numberOfLines={2}>
                  {item.title}
                </Text>
                {!!item.message && (
                  <Text style={styles.nMessage} numberOfLines={3}>{item.message}</Text>
                )}
                <Text style={styles.nDate}>{formatDateTime(item.createdAt)}</Text>
              </View>
              {!item.isRead ? <View style={styles.unreadDot} /> : null}
            </Card>
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
  readAll: { color: colors.primary, fontSize: 12.5, fontWeight: '600' },
  list: { padding: 20, paddingTop: 4, paddingBottom: 40, gap: 10 },
  empty: { color: colors.mutedForeground, textAlign: 'center', marginTop: 40 },
  pressed: { opacity: 0.75 },
  card: { flexDirection: 'row', gap: 12 },
  cardUnread: { borderColor: `${colors.primary}55` },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nTitle: { color: colors.sidebarText, fontSize: 14, fontWeight: '500' },
  nTitleUnread: { fontWeight: '700', color: colors.foreground },
  nMessage: { color: colors.mutedForeground, fontSize: 12.5, marginTop: 2 },
  nDate: { color: colors.sidebarMuted, fontSize: 11, marginTop: 5 },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
    alignSelf: 'center',
  },
});
