import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { Check, Lock } from 'lucide-react';
import { colors } from '@/theme/colors';

export interface NotificationPreferenceCategory {
  category: string;
  pushEnabled: boolean;
  lockedByAdmin: boolean;
}

const NOTIFICATION_CATEGORIES = [
  'TASKS',
  'CALENDAR',
  'ROUTINE',
  'COLLABORATION',
  'PROJECTS_TEAMS',
  'SECURITY',
] as const;

export default function NotificationPreferencesScreen() {
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const role = useAuthStore((s) => s.role);
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id, tenant?.id],
    queryFn: async () => {
      if (!user?.id || !tenant?.id) return [];
       const res = await api.get('/notification-preferences');
      return res.data;
    },
    enabled: !!user?.id && !!tenant?.id,
  });

  const mutateAsync = useMutation({
    mutationFn: async ({ category, pushEnabled }: { category: string; pushEnabled: boolean }) => {
      if (!user?.id || !tenant?.id) throw new Error('User or tenant not found');
      try {
        await api.patch(`/notification-preferences/${category}`, { pushEnabled });
        queryClient.invalidateQueries({ queryKey: ['notification-preferences', user.id, tenant.id] });
      } catch (e: any) {
        if (e?.response?.status === 409) {
          setMessage('Essa categoria é gerenciada pela empresa e não pode ser alterada.');
          throw e;
        }
        throw e;
      }
    },
    onSuccess: () => {
      setMessage(null);
    },
  });

  const categories: NotificationPreferenceCategory[] = (preferences || []).map((p: any) => ({
    category: p.category,
    pushEnabled: p.pushEnabled,
    lockedByAdmin: p.lockedByAdmin,
  }));

  if (isLoading) return <Text>Carregando...</Text>;

  return (
    <View style={styles.container}>
      <FlatList
        data={NOTIFICATION_CATEGORIES}
        keyExtractor={(c) => c}
        renderItem={({ item }: { item: string }) => {
          const cat = categories.find((c) => c.category === item);
          if (!cat) return null;
          const disabled = cat.lockedByAdmin;
          return (
            <Pressable
              onPress={disabled ? null : async () => {
                if (!disabled) {
                   await mutateAsync.mutateAsync({ category: item, pushEnabled: !cat.pushEnabled });
                }
              }}
              disabled={disabled}
              style={styles.categoryCard}
            >
              <View style={styles.row}>
                <View style={styles.checkboxContainer}>
                  {cat.pushEnabled ? <Check size={20} color={colors.primary} /> : null}
                </View>
                <Text style={styles.categoryLabel}>{item}</Text>
                {cat.lockedByAdmin && (
                  <Text style={styles.lockedText}>Gerenciada pela empresa</Text>
                )}
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={styles.list}
      />
      {message && (
        <View style={styles.alertContainer}>
          <Text style={styles.alertTitle}>Informação</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <Pressable style={styles.alertOk} onPress={() => setMessage(null)}>
            <Text style={styles.alertOkText}>OK</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  list: { gap: 16 },
  categoryCard: { borderWidth: 1, borderRadius: 12, padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkboxContainer: { width: 24, height: 24, borderWidth: 2, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderColor: '#d1d5db' },
  categoryLabel: { flex: 1, fontSize: 16, color: '#374151' },
  lockedText: { color: '#ef4444', fontSize: 12, marginLeft: 8 },
  alertContainer: { padding: 20, backgroundColor: '#f3f4f6', borderRadius: 12, marginTop: 20 },
  alertTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  alertMessage: { fontSize: 16, color: '#374151', marginBottom: 16 },
  alertOk: { alignSelf: 'center', marginTop: 16 },
  alertOkText: { color: '#3b82f6' },
});
