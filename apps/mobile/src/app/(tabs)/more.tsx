import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { unregisterPushToken } from '@/lib/push';
import { colors } from '@/theme/colors';

const SECTIONS: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  route?: string;
  permission?: string;
}[] = [
  { icon: 'list', label: 'Rotina Diária', route: '/routine' },
  { icon: 'users', label: 'Equipes', route: '/teams' },
  { icon: 'user', label: 'Colaboradores', route: '/collaborators' },
  { icon: 'calendar', label: 'Calendário', route: '/calendar' },
  { icon: 'phone', label: 'Contatos', route: '/contacts' },
  { icon: 'mail', label: 'E-mail', route: '/emails', permission: 'email.view' },
  { icon: 'bell', label: 'Notificações', route: '/notifications' },
  { icon: 'shield', label: 'Auditoria', route: '/audit', permission: 'audit.view' },
  { icon: 'activity', label: 'Atividades', route: '/operational', permission: 'audit.view' },
  { icon: 'settings', label: 'Configurações' },
];

export default function MoreScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const role = useAuthStore((s) => s.role);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // mesmo se falhar, limpa a sessão local
    }
    await unregisterPushToken();
    // clearSession zera tokens → guarda de rotas redireciona ao login
    useAuthStore.getState().clearSession();
  };

  const visible = SECTIONS.filter((s) => !s.permission || can(s.permission));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Perfil */}
        <Pressable
          onPress={() => router.push('/profile-edit')}
          style={({ pressed }) => [styles.profileCard, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name ?? 'Usuário'}</Text>
            <Text style={styles.profileMeta}>{user?.email}</Text>
            <Text style={styles.profileMeta}>
              {tenant?.name}
              {role ? ` · ${role}` : ''}
            </Text>
          </View>
          <Feather name="edit-2" size={16} color={colors.sidebarMuted} />
        </Pressable>

        {/* Seções */}
        <View style={styles.sectionCard}>
          {visible.map((section, i) => (
            <Pressable
              key={section.label}
              onPress={() =>
                section.route
                  ? router.push(section.route as never)
                  : undefined
              }
              disabled={!section.route}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.rowBorder,
                pressed && styles.rowPressed,
              ]}
            >
              <Feather name={section.icon} size={18} color={colors.mutedForeground} />
              <Text style={[styles.rowLabel, !section.route && styles.rowDisabled]}>
                {section.label}
              </Text>
              {!section.route ? (
                <Text style={styles.soon}>em breve</Text>
              ) : (
                <Feather name="chevron-right" size={16} color={colors.sidebarMuted} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Sair */}
        <Pressable onPress={logout} style={({ pressed }) => [styles.logout, pressed && styles.rowPressed]}>
          <Feather name="log-out" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </Pressable>

        <Text style={styles.version}>Quadro do Manê Mobile · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primaryForeground, fontSize: 20, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileName: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  profileMeta: { color: colors.mutedForeground, fontSize: 13, marginTop: 2 },
  sectionCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: { borderTopColor: colors.cardBorder, borderTopWidth: 1 },
  rowPressed: { opacity: 0.7 },
  rowLabel: { flex: 1, color: colors.sidebarText, fontSize: 15, fontWeight: '500' },
  rowDisabled: { color: colors.mutedForeground },
  soon: { color: colors.sidebarMuted, fontSize: 11, fontStyle: 'italic' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.25)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  logoutText: { color: colors.error, fontSize: 15, fontWeight: '600' },
  version: { color: colors.sidebarMuted, fontSize: 11, textAlign: 'center', marginTop: 24 },
});
