import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

export default function ProjectChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Voltar">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Assistente do projeto</Text>
          <Text style={styles.subtitle}>Projeto {id}</Text>
        </View>
        <Feather name="cpu" size={20} color={colors.primary} />
      </View>

      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Feather name="message-circle" size={25} color={colors.primaryForeground} />
          </View>
          <Text style={styles.heroTitle}>Converse com a IA do projeto</Text>
          <Text style={styles.heroText}>
            Em breve você poderá perguntar sobre tarefas, prazos e andamento, e pedir ações dentro deste projeto.
          </Text>
        </View>
      </View>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Pergunte algo sobre o projeto..."
          placeholderTextColor={colors.mutedForeground}
          editable={false}
        />
        <Pressable style={styles.sendButton} disabled accessibilityLabel="Enviar mensagem">
          <Feather name="send" size={17} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: 1,
  },
  titleWrap: { flex: 1 },
  title: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  subtitle: { color: colors.mutedForeground, fontSize: 11, marginTop: 2 },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  hero: { alignItems: 'center', maxWidth: 360, alignSelf: 'center' },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: 16,
  },
  heroTitle: { color: colors.foreground, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  heroText: { color: colors.mutedForeground, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopColor: colors.cardBorder,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    backgroundColor: colors.inputBg,
    color: colors.foreground,
    paddingHorizontal: 13,
  },
  sendButton: {
    width: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    opacity: 0.45,
  },
});
