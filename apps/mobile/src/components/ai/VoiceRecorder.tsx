import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from 'expo-audio';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/theme/colors';
import { createRecordingLifecycle, createRecordingMachine } from '@/lib/ai-chat-state';

export function VoiceRecorder({ disabled, onSubmitted }: { disabled?: boolean; onSubmitted: (uri: string) => Promise<void> | void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [machine] = useState(createRecordingMachine);
  const [lifecycle] = useState(createRecordingLifecycle);
  const [state, setState] = useState(() => machine.getState());
  const [busy, setBusy] = useState(false);
  const cancelling = useRef(false);
  const submitRef = useRef(onSubmitted);
  const disabledRef = useRef(disabled);
  const busyRef = useRef(busy);

  useEffect(() => { disabledRef.current = disabled; }, [disabled]);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => { submitRef.current = onSubmitted; }, [onSubmitted]);

  const start = useCallback(async () => {
    if (disabledRef.current || busyRef.current) return;
    lifecycle.begin();
    const started = await lifecycle.start(async () => {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) return false;
      await recorder.prepareToRecordAsync();
      if (!lifecycle.canStart()) return false;
      recorder.record();
      return true;
    }, () => recorder.stop());
    if (!started) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setState(machine.press());
  }, [lifecycle, recorder, machine]);

  const finish = useCallback(async () => {
    const next = machine.release();
    setState(next);
    if (next.state !== 'submitted') return;
    await recorder.stop();
    if (!recorder.uri) return;
    setBusy(true);
    try { await submitRef.current(recorder.uri); } finally { setBusy(false); }
  }, [machine, recorder]);

  const cancelRecording = useCallback(async () => {
    if (cancelling.current) return;
    cancelling.current = true;
    setState(machine.cancel());
    try {
      await lifecycle.cancel(() => recorder.stop());
      setState(machine.release());
    } finally {
      cancelling.current = false;
    }
  }, [lifecycle, machine, recorder]);

  // PanResponder is a stable native gesture object; the compiler rule is a false positive here.
  // eslint-disable-next-line react-hooks/refs
  const responder = useMemo(() => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { void start(); },
      onPanResponderMove: (_, gesture) => {
        const previous = machine.getState().state;
        const nextState = machine.move(gesture.dy);
        setState(nextState);
        if (nextState.state === 'cancelled' && previous !== 'cancelled') void cancelRecording();
      },
      onPanResponderRelease: () => { void finish(); },
      onPanResponderTerminate: () => { void cancelRecording(); },
    }), [cancelRecording, finish, machine, start]);

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
