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
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { api, apiErrorMessage } from '@/lib/api';
import { colors } from '@/theme/colors';

const DAY_PRESETS: { label: string; days: number }[] = [
  { label: 'Hoje', days: 0 },
  { label: 'Amanhã', days: 1 },
  { label: 'Em 3 dias', days: 3 },
  { label: 'Próx. semana', days: 7 },
];

export default function EventCreateScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayOffset, setDayOffset] = useState<number | null>(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false);

  const isoFor = (offset: number, time: string, endOfDay = false) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if (!allDay && !endOfDay && /^\d{2}:\d{2}$/.test(time)) {
      const [h, m] = time.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    } else if (allDay || endOfDay) {
      d.setHours(23, 59, 0, 0);
    } else {
      d.setHours(9, 0, 0, 0);
    }
    return d.toISOString();
  };

  const save = async () => {
    if (!title.trim() || dayOffset === null || saving) return;
    if (!allDay && !/^\d{2}:\d{2}$/.test(startTime.trim())) {
      Alert.alert('Atenção', 'Informe o horário de início (HH:mm).');
      return;
    }
    setSaving(true);
    try {
      await api.post('/events', {
        title: title.trim(),
        description: description.trim() || undefined,
        allDay,
        startAt: isoFor(dayOffset, startTime.trim()),
        endAt: allDay ? isoFor(dayOffset, '', true) : isoEnd(dayOffset, endTime.trim()),
      });
      router.back();
    } catch (e) {
      Alert.alert('Erro', apiErrorMessage(e, 'Não foi possível criar o evento.'));
    } finally {
      setSaving(false);
    }
  };

  const isoEnd = (offset: number, time: string) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if (/^\d{2}:\d{2}$/.test(time)) {
      const [h, m] = time.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    } else {
      d.setHours(10, 0, 0, 0);
    }
    return d.toISOString();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.cancel}>Cancelar</Text>
        </Pressable>
        <Text style={styles.title}>Novo evento</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Título *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: Reunião de planejamento"
          placeholderTextColor={colors.mutedForeground}
          value={title}
          onChangeText={setTitle}
          editable={!saving}
        />

        <Text style={styles.label}>Dia</Text>
        <View style={styles.chipRow}>
          {DAY_PRESETS.map((p) => (
            <Pressable
              key={p.label}
              onPress={() => setDayOffset(p.days)}
              style={[styles.chip, dayOffset === p.days && styles.chipActive]}
            >
              <Text
                style={[styles.chipText, dayOffset === p.days && styles.chipTextActive]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => setAllDay((v) => !v)}
          style={({ pressed }) => [styles.allDayRow, pressed && { opacity: 0.8 }]}
        >
          <View style={[styles.checkbox, allDay && styles.checkboxDone]}>
            {allDay ? <Feather name="check" size={13} color="#fff" /> : null}
          </View>
          <Text style={styles.allDayText}>Dia inteiro</Text>
        </Pressable>

        {!allDay ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Início</Text>
              <TextInput
                style={styles.input}
                placeholder="09:00"
                placeholderTextColor={colors.mutedForeground}
                value={startTime}
                onChangeText={setStartTime}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                editable={!saving}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fim</Text>
              <TextInput
                style={styles.input}
                placeholder="10:00"
                placeholderTextColor={colors.mutedForeground}
                value={endTime}
                onChangeText={setEndTime}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                editable={!saving}
              />
            </View>
          </View>
        ) : null}

        <Text style={styles.label}>Descrição</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Detalhes do evento..."
          placeholderTextColor={colors.mutedForeground}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          editable={!saving}
        />

        <Pressable
          onPress={() => void save()}
          disabled={!title.trim() || dayOffset === null || saving}
          style={[
            styles.saveBtn,
            (!title.trim() || dayOffset === null || saving) && styles.disabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.saveText}>Criar evento</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: 1,
  },
  cancel: { color: colors.mutedForeground, fontSize: 14, width: 60 },
  title: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  scroll: { padding: 20 },
  label: {
    color: colors.sidebarText,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 18,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.foreground,
    fontSize: 15,
  },
  textarea: { minHeight: 90, paddingTop: 12 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: `${colors.primary}26`, borderColor: colors.primary },
  chipText: { color: colors.sidebarText, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
  allDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  allDayText: { color: colors.sidebarText, fontSize: 14, fontWeight: '500' },
  saveBtn: {
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  saveText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' },
});
