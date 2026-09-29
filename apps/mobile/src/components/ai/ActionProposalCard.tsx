import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/theme/colors';
import { apiErrorMessage } from '@/lib/api';
import { cancelAction, confirmAction, type AiActionProposal, type AiActionResult } from '@/lib/ai-chat';

export function ActionProposalCard({ proposal, onChanged }: { proposal: AiActionProposal; onChanged?: (result?: AiActionResult) => void }) {
  const [status, setStatus] = useState(proposal.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, nextStatus: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action() as AiActionResult | undefined;
      setStatus(nextStatus);
      onChanged?.(result ?? { ...proposal, status: nextStatus });
    } catch (e) {
      setError(apiErrorMessage(e, 'Não foi possível atualizar a proposta'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Feather name="zap" size={16} color={colors.primary} />
        <Text style={styles.label}>Ação sugerida</Text>
      </View>
      <Text style={styles.summary}>{proposal.summary}</Text>
      {status === 'PENDING' ? (
        <View style={styles.actions}>
          <Pressable disabled={busy} onPress={() => void run(() => confirmAction(proposal.id), 'EXECUTED')} style={styles.confirm}>
            {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.confirmText}>Confirmar</Text>}
          </Pressable>
          <Pressable disabled={busy} onPress={() => void run(() => cancelAction(proposal.id), 'CANCELLED')} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      ) : <Text style={styles.status}>{status === 'EXECUTED' ? 'Concluída' : 'Cancelada'}</Text>}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  summary: { color: colors.foreground, fontSize: 14, lineHeight: 20, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  confirm: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.primary },
  confirmText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  cancel: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: colors.cardBorder },
  cancelText: { color: colors.foreground, fontWeight: '600', fontSize: 13 },
  status: { color: colors.mutedForeground, marginTop: 10, fontSize: 12 },
  error: { color: colors.error, marginTop: 8, fontSize: 12 },
});
