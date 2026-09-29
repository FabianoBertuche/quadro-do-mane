import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAudioPlayer } from 'expo-audio';
import { colors } from '@/theme/colors';
import { getAudioUrl, type AiMessage } from '@/lib/ai-chat';

export function ChatMessage({ message }: { message: AiMessage }) {
  const audioUrl = message.audioObjectKey ? getAudioUrl(message.audioObjectKey) : null;
  const player = useAudioPlayer(audioUrl);
  const isUser = message.role === 'user';

  useEffect(() => () => player.pause(), [player]);

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {message.content ? <Text style={styles.content}>{message.content}</Text> : null}
        {audioUrl ? (
          <Pressable onPress={() => player.play()} style={styles.audio} accessibilityLabel="Reproduzir áudio">
            <Feather name="play" size={16} color={isUser ? colors.primaryForeground : colors.primary} />
            <Text style={[styles.audioText, isUser && styles.userAudioText]}>Ouvir resposta</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', marginVertical: 4 },
  userRow: { alignItems: 'flex-end' },
  assistantRow: { alignItems: 'flex-start' },
  bubble: { maxWidth: '86%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderBottomLeftRadius: 4 },
  content: { color: colors.foreground, fontSize: 15, lineHeight: 21 },
  audio: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  audioText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  userAudioText: { color: colors.primaryForeground },
});
