import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api, apiErrorMessage } from '@/lib/api';
import { can } from '@/lib/permissions';
import { colors } from '@/theme/colors';

export default function EmailComposeScreen() {
  const router = useRouter();
  const { replyToUid, to, subject } = useLocalSearchParams<{
    replyToUid?: string;
    to?: string;
    subject?: string;
  }>();
  const isReply = !!replyToUid;

  const [recipient, setRecipient] = useState(to ?? '');
  const [emailSubject, setEmailSubject] = useState(subject ?? '');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  if (!can('email.view')) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <TopBar title={isReply ? 'Responder' : 'Novo e-mail'} onBack={() => router.back()} />
        <Text style={styles.noAccess}>Sem permissão para e-mail.</Text>
      </SafeAreaView>
    );
  }

  const send = async () => {
    if (sending) return;
    if (!isReply && !recipient.trim()) {
      Alert.alert('Atenção', 'Informe o destinatário.');
      return;
    }
    if (!isReply && !emailSubject.trim()) {
      Alert.alert('Atenção', 'Informe o assunto.');
      return;
    }
    if (!body.trim()) {
      Alert.alert('Atenção', 'Escreva a mensagem.');
      return;
    }
    setSending(true);
    try {
      if (isReply) {
        await api.post('/emails/reply', { uid: replyToUid, body: body.trim() });
      } else {
        await api.post('/emails/send', {
          to: recipient.trim(),
          subject: emailSubject.trim(),
          content: body.trim(),
        });
      }
      Alert.alert('Enviado', 'E-mail enviado com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Erro', apiErrorMessage(e, 'Não foi possível enviar o e-mail.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopBar
        title={isReply ? 'Responder' : 'Novo e-mail'}
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => void send()} disabled={sending} hitSlop={8}>
            {sending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="send" size={20} color={colors.primary} />
            )}
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!isReply ? (
          <>
            <Text style={styles.label}>Para *</Text>
            <TextInput
              style={styles.input}
              placeholder="destinatario@exemplo.com"
              placeholderTextColor={colors.mutedForeground}
              value={recipient}
              onChangeText={setRecipient}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!sending}
            />
            <Text style={styles.label}>Assunto *</Text>
            <TextInput
              style={styles.input}
              placeholder="Assunto da mensagem"
              placeholderTextColor={colors.mutedForeground}
              value={emailSubject}
              onChangeText={setEmailSubject}
              editable={!sending}
            />
          </>
        ) : (
          <View style={styles.replyMeta}>
            <Feather name="corner-up-left" size={14} color={colors.mutedForeground} />
            <Text style={styles.replyMetaText} numberOfLines={1}>
              Respondendo a {to ?? ''} — {subject ?? ''}
            </Text>
          </View>
        )}
        <Text style={styles.label}>Mensagem *</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Escreva sua mensagem..."
          placeholderTextColor={colors.mutedForeground}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
          editable={!sending}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function TopBar({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} hitSlop={10}>
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      <View style={{ minWidth: 24, alignItems: 'flex-end' }}>{right ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: 1,
  },
  topTitle: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 40 },
  noAccess: { color: colors.mutedForeground, textAlign: 'center', marginTop: 40 },
  label: {
    color: colors.sidebarText,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  textarea: { minHeight: 160 },
  replyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  replyMetaText: { flex: 1, color: colors.mutedForeground, fontSize: 13 },
});
