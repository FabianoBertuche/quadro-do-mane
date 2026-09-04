import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api, apiErrorMessage } from './api';

/**
 * Push notifications (Expo).
 *
 * O registro é tolerante a falhas: sem permissão, emulador sem Google
 * Services ou Expo Go sem projeto EAS, o app continua funcionando —
 * apenas não há push.
 */
let registered = false;
let currentToken: string | null = null;

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/** Registra o device no backend. Chamar após login/hidratação da sessão. */
export async function registerPushToken(): Promise<void> {
  if (registered) return;
  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted && settings.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Geral',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#5B5FEF',
      });
    }

    // Token Expo (formato ExponentPushToken[...]) — em builds standalone
    // é preciso ter extra.eas.projectId no app.config.js e google-services.json
    // configurado para Android.
    const t = await Notifications.getExpoPushTokenAsync();
    const token = typeof t === 'string' ? t : t.data;
    if (!token || !token.startsWith('Expo')) {
      console.warn('[push] token Expo não obtido (falta integração FCM no Android?)');
      return;
    }

    const res = await api.post('/push-devices', {
      expoPushToken: token,
      platform: Platform.OS,
    });

    // Se o backend rejeitou (token inválido), não marca como registrado.
    if (res.data && res.data.success === false) {
      console.warn('[push] token rejeitado pelo backend');
      return;
    }

    currentToken = token;
    registered = true;

    // Listener: toque na notificação abre o app (deep link futuro por data.taskId)
    Notifications.addNotificationResponseReceivedListener(() => {
      // v1: apenas abre o app; navegação por payload vem depois
    });
  } catch (err) {
    console.warn('[push] registro falhou:', apiErrorMessage(err));
  }
}

/** Remove o registro do backend (logout). */
export async function unregisterPushToken(): Promise<void> {
  const token = currentToken;
  registered = false;
  currentToken = null;
  if (!token) return;
  try {
    await api.delete(`/push-devices/${encodeURIComponent(token)}`);
  } catch (err) {
    console.warn('[push] unregister falhou:', apiErrorMessage(err));
  }
}
