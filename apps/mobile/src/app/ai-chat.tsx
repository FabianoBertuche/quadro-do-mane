import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/api';
import {
  getConversationMessages, getResponseMode, mergeHistoryPage, openConversation, sendAudioMessage, sendTextMessage, setResponseMode,
  type AiActionProposal, type AiConversation, type AiMessage, type AiMessageResponse,
} from '@/lib/ai-chat';
import { ChatMessage } from '@/components/ai/ChatMessage';
import { ActionProposalCard } from '@/components/ai/ActionProposalCard';
import { VoiceRecorder } from '@/components/ai/VoiceRecorder';

const responseModesByConversation = new Map<string, 'TEXT' | 'AUDIO'>();

export default function AiChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ contextProjectId?: string }>();
  const contextProjectId = Array.isArray(params.contextProjectId) ? params.contextProjectId[0] : params.contextProjectId;
  const [conversation, setConversation] = useState<AiConversation | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [proposals, setProposals] = useState<AiActionProposal[]>([]);
  const [text, setText] = useState('');
  const [responseMode, setSelectedResponseMode] = useState<'TEXT' | 'AUDIO'>('TEXT');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const listRef = useRef<FlatList<AiMessage>>(null);
  const responseModes = useRef(responseModesByConversation);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const created = await openConversation(contextProjectId);
        const history = await getConversationMessages(created.id);
        if (!active) return;
        setConversation(created);
        setMessages(history.messages);
        setProposals(history.pendingProposals);
        setHistoryPage(1);
        setHasMore(history.messages.length === 50);
        setSelectedResponseMode(getResponseMode(responseModes.current, created.id));
      } catch (e) {
        if (active) setError(apiErrorMessage(e, 'Não foi possível abrir o assistente'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [contextProjectId]);

  const loadMore = async () => {
    if (!conversation || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = historyPage + 1;
      const history = await getConversationMessages(conversation.id, nextPage);
      setMessages((current) => mergeHistoryPage(current, history.messages));
      setProposals((current) => [...current, ...history.pendingProposals.filter((next) => !current.some((item) => item.id === next.id))]);
      setHistoryPage(nextPage);
      setHasMore(history.messages.length === 50);
    } catch (e) {
      setError(apiErrorMessage(e, 'Não foi possível carregar o histórico'));
    } finally {
      setLoadingMore(false);
    }
  };

  const selectResponseMode = (mode: 'TEXT' | 'AUDIO') => {
    if (conversation) setResponseMode(responseModes.current, conversation.id, mode);
    setSelectedResponseMode(mode);
  };

  const send = async (request: () => Promise<AiMessageResponse>) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await request();
      const assistantMessage = result.audioObjectKey
        ? { ...result.assistantMessage, audioObjectKey: result.audioObjectKey }
        : result.assistantMessage;
      setMessages((current) => [...current, result.message, assistantMessage]);
      setProposals((current) => [...result.proposals, ...current.filter((old) => !result.proposals.some((next) => next.id === old.id))]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 0);
    } catch (e) {
      setError(apiErrorMessage(e, 'Não foi possível enviar a mensagem'));
    } finally {
      setPending(false);
    }
  };

  const sendText = () => {
    const value = text.trim();
    if (!conversation || !value) return;
    setText('');
    void send(() => sendTextMessage({ conversationId: conversation.id, text: value, responseMode, contextProjectId }));
  };

  const sendAudio = async (uri: string) => {
    if (!conversation) return;
    await send(() => sendAudioMessage({ conversationId: conversation.id, uri, mimeType: 'audio/m4a', responseMode }));
  };

  const allItems = useMemo(() => messages, [messages]);
  const onProposalChanged = (result?: { status?: string; message?: AiMessage }) => {
    if (result?.message) setMessages((current) => [...current, result.message as AiMessage]);
    if (result?.status !== 'PENDING') setProposals((current) => current.filter((item) => item.status === 'PENDING'));
  };
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Abrindo assistente...</Text></View>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Voltar"><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable>
        <View style={styles.headerText}><Text style={styles.title}>Assistente IA</Text><Text style={styles.subtitle}>{contextProjectId ? 'Contexto do projeto ativo' : 'Conversa global'}</Text></View>
        <Feather name="cpu" size={20} color={colors.primary} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={allItems}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.list}
          onEndReached={() => { void loadMore(); }}
          onEndReachedThreshold={0.25}
          ListHeaderComponent={loadingMore ? <ActivityIndicator color={colors.primary} /> : null}
          renderItem={({ item }) => <ChatMessage message={item} />}
          ListEmptyComponent={<View style={styles.empty}><Feather name="message-circle" size={30} color={colors.primary} /><Text style={styles.emptyTitle}>Como posso ajudar?</Text><Text style={styles.muted}>Pergunte sobre tarefas, prazos e projetos.</Text></View>}
          ListFooterComponent={<>{proposals.map((proposal) => <ActionProposalCard key={proposal.id} proposal={proposal} onChanged={onProposalChanged} />)}</>}
        />
        <View style={styles.composer}>
          <View style={styles.modePicker}>
            {(['TEXT', 'AUDIO'] as const).map((mode) => <Pressable key={mode} onPress={() => selectResponseMode(mode)} style={[styles.mode, responseMode === mode && styles.modeActive]}><Text style={[styles.modeText, responseMode === mode && styles.modeTextActive]}>{mode === 'TEXT' ? 'Texto' : 'Voz'}</Text></Pressable>)}
          </View>
          <View style={styles.inputRow}>
            <TextInput value={text} onChangeText={setText} onSubmitEditing={sendText} editable={!pending} placeholder="Pergunte algo..." placeholderTextColor={colors.mutedForeground} style={styles.input} multiline maxLength={4000} />
            {text.trim() ? <Pressable disabled={pending} onPress={sendText} style={styles.send}><Feather name="send" size={17} color={colors.primaryForeground} /></Pressable> : <VoiceRecorder disabled={pending} onSubmitted={sendAudio} />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12, borderBottomColor: colors.cardBorder, borderBottomWidth: 1 },
  headerText: { flex: 1 },
  title: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
  subtitle: { color: colors.mutedForeground, fontSize: 11, marginTop: 2 },
  body: { flex: 1 },
  list: { padding: 16, paddingBottom: 20, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, minHeight: 300 },
  emptyTitle: { color: colors.foreground, fontSize: 19, fontWeight: '800', marginTop: 6 },
  muted: { color: colors.mutedForeground, fontSize: 13 },
  error: { color: colors.error, paddingHorizontal: 20, paddingVertical: 8, fontSize: 12 },
  composer: { padding: 12, borderTopColor: colors.cardBorder, borderTopWidth: 1, backgroundColor: colors.background },
  modePicker: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: colors.card, borderRadius: 9, padding: 3, marginBottom: 8 },
  mode: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 7 },
  modeActive: { backgroundColor: colors.primary },
  modeText: { color: colors.mutedForeground, fontSize: 12, fontWeight: '600' },
  modeTextActive: { color: colors.primaryForeground },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: { flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 13, borderColor: colors.cardBorder, borderWidth: 1, backgroundColor: colors.inputBg, color: colors.foreground, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 10 },
  send: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
