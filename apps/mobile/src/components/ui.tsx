import { ReactNode } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { colors } from '@/theme/colors';

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[cardStyles.card, style]}>{children}</View>;
}

export function Avatar({
  name,
  size = 36,
  url,
}: {
  name?: string | null;
  size?: number;
  url?: string | null;
}) {
  const initial = name?.charAt(0)?.toUpperCase() ?? '?';
  return (
    <View
      style={[
        cardStyles.avatar,
        { width: size, height: size, borderRadius: size * 0.3 },
      ]}
    >
      <Text style={{ color: colors.primaryForeground, fontWeight: '700', fontSize: size * 0.45 }}>
        {initial}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  color = colors.mutedForeground,
  filled = false,
}: {
  label: string;
  color?: string | null;
  filled?: boolean;
}) {
  const c = color || colors.mutedForeground;
  return (
    <View
      style={[
        cardStyles.chip,
        filled ? { backgroundColor: `${c}33`, borderColor: `${c}66` } : {},
      ]}
    >
      <View style={[cardStyles.chipDot, { backgroundColor: c }]} />
      <Text style={[cardStyles.chipText, { color: c }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function StatCard({
  icon,
  value,
  label,
  tone = colors.primary,
}: {
  icon: string;
  value: number | string;
  label: string;
  tone?: string;
}) {
  return (
    <View style={cardStyles.stat}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={[cardStyles.statValue, { color: tone }]}>{value}</Text>
      <Text style={cardStyles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={cardStyles.segmentWrap}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[cardStyles.segment, value === o.value && cardStyles.segmentActive]}
        >
          <Text
            style={[
              cardStyles.segmentText,
              value === o.value && cardStyles.segmentTextActive,
            ]}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Loading({ label = 'Carregando...' }: { label?: string }) {
  return (
    <View style={cardStyles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={cardStyles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={cardStyles.center}>
      <Text style={{ fontSize: 34 }}>⚠️</Text>
      <Text style={[cardStyles.muted, { textAlign: 'center', maxWidth: 260 }]}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={cardStyles.retryBtn}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Tentar novamente</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Lista horizontal de chips selecionáveis (pickers de status/prioridade). */
export function OptionChips({
  options,
  valueId,
  onSelect,
}: {
  options: { id: string; name: string; color?: string | null; level?: number }[];
  valueId?: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => {
        const active = o.id === valueId;
        const c = o.color || colors.primary;
        return (
          <Pressable
            key={o.id}
            onPress={() => onSelect(o.id)}
            style={[
              cardStyles.optionChip,
              active && { backgroundColor: `${c}30`, borderColor: c },
            ]}
          >
            <Text style={[cardStyles.optionChipText, active && { color: c }]}>
              {o.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  avatar: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11, fontWeight: '600' },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
    gap: 2,
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { color: colors.mutedForeground, fontSize: 11 },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.mutedForeground, fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: colors.primaryForeground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  muted: { color: colors.mutedForeground, fontSize: 13 },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.card,
  },
  optionChipText: { color: colors.sidebarText, fontSize: 13, fontWeight: '600' },
});
