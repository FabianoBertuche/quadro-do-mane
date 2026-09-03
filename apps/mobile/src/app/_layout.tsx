import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/lib/auth';
import { hydrateSession } from '@/lib/session';
import {
  configureNotificationHandler,
  registerPushToken,
} from '@/lib/push';
import { colors } from '@/theme/colors';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const AUTH_ROUTES = ['/login', '/select-tenant'];

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    try {
      configureNotificationHandler();
    } catch (e) {
      console.warn('[push] notification handler setup failed:', e);
    }
    void hydrateSession();
  }, []);

  // Registra push assim que existe sessão válida
  useEffect(() => {
    if (hydrated && accessToken) {
      void registerPushToken();
    }
  }, [hydrated, accessToken]);

  // Guarda de rotas: sem sessão → login; com sessão → tabs.
  useEffect(() => {
    if (!hydrated || !pathname) return;
    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    if (!accessToken && !isAuthRoute) {
      router.replace('/login');
    } else if (accessToken && isAuthRoute) {
      router.replace('/dashboard');
    }
  }, [hydrated, accessToken, pathname, router]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="(auth)/select-tenant" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="project/[id]"
            options={{ presentation: 'card', animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="task/[id]"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="task-create" options={{ presentation: 'modal' }} />
          <Stack.Screen name="project-create" options={{ presentation: 'modal' }} />
          <Stack.Screen name="teams" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="collaborators" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="calendar" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="contacts" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="email/[uid]"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="routine" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="audit" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="operational" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
