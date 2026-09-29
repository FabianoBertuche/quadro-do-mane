import { useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from 'expo-audio';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/theme/colors';
import { createRecordingMachine, stopAndCancelRecording } from '@/lib/ai-chat-state';

export function VoiceRecorder({ disabled, onSubmitted }: { disabled?: boolean; onSubmitted: (uri: string) => Promise<void> | void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [machine] = useState(createRecordingMachine);
  const [state, setState] = useState(() => machine.getState());
  const [busy, setBusy] = useState(false);
  const cancelling = useRef(false);

  const start = async () => {
    if (disabled || busy) return;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return;
    await recorder.prepareToRecordAsync();
    recorder.record();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setState(machine.press());
  };

  const finish = async () => {
    const next = machine.release();
    setState(next);
    if (next.state !== 'submitted') return;
    await recorder.stop();
    if (!recorder.uri) return;
    setBusy(true);
    try { await onSubmitted(recorder.uri); } finally { setBusy(false); }
  };

  const cancelRecording = async () => {
    if (cancelling.current || machine.getState().state === 'idle' || machine.getState().state === 'submitted') return;
    cancelling.current = true;
    setState(machine.cancel());
    try {
      await stopAndCancelRecording(
        () => recorder.stop(),
        () => setState(machine.release()),
      );
    } finally {
      cancelling.current = false;
    }
  };

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: () => { void start(); },
    onPanResponderMove: (_, gesture) => {
      const previous = machine.getState().state;
      const next = machine.move(gesture.dy);
      setState(next);
      if (next.state === 'cancelled' && previous !== 'cancelled') void cancelRecording();
    },
    onPanResponderRelease: () => { void finish(); },
    onPanResponderTerminate: () => { void cancelRecording(); },
  });

  return (
    <View {...responder.panHandlers}>
      <Pressable disabled={disabled || busy} onPressIn={() => undefined} style={[styles.button, state.state !== 'idle' && styles.active]} accessibilityLabel="Gravar mensagem de voz">
        {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Feather name="mic" size={19} color={colors.primaryForeground} />}
      </Pressable>
      {state.state === 'recording' || state.state === 'locked' ? <Text style={styles.hint}>{state.state === 'locked' ? 'Solte para enviar' : 'Arraste para cima para bloquear'}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: colors.error },
  hint: { position: 'absolute', right: 0, bottom: 51, width: 190, textAlign: 'right', color: colors.mutedForeground, fontSize: 11 },
});
