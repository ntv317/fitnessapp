import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/core/ui/AppText';
import { Colors, Spacing, Radius, Fonts, FontSize } from '@/core/theme';
import { useBarbellConfig, ALL_PLATE_SIZES } from '@/features/workout/hooks/useBarbellConfig';

const PRESET_BARS = [15, 20] as const;

export default function BarbellSetupScreen() {
  const router = useRouter();
  const { config, saveConfig } = useBarbellConfig();

  const [barWeight, setBarWeight] = useState(config.barWeight);
  const [customBar, setCustomBar] = useState(
    PRESET_BARS.includes(config.barWeight as 15 | 20) ? '' : String(config.barWeight),
  );
  const [isCustom, setIsCustom] = useState(!PRESET_BARS.includes(config.barWeight as 15 | 20));
  const [plates, setPlates] = useState<Set<number>>(new Set(config.plates));

  const togglePlate = (p: number) => {
    setPlates((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  };

  const handleSave = async () => {
    const bar = isCustom ? parseFloat(customBar) || 20 : barWeight;
    await saveConfig({ barWeight: bar, plates: [...plates].sort((a, b) => a - b) });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.title}>
          Barbell Setup
        </AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Bar Weight */}
        <AppText variant="labelMono" upper color={Colors.textMuted} style={styles.sectionLabel}>
          Bar Weight
        </AppText>
        <View style={styles.segmentRow}>
          {PRESET_BARS.map((b) => (
            <TouchableOpacity
              key={b}
              style={[styles.segment, !isCustom && barWeight === b && styles.segmentActive]}
              onPress={() => { setBarWeight(b); setIsCustom(false); }}
            >
              <AppText
                variant="bodyMd"
                style={[styles.segmentText, !isCustom && barWeight === b && styles.segmentTextActive]}
              >
                {b} kg
              </AppText>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.segment, isCustom && styles.segmentActive]}
            onPress={() => setIsCustom(true)}
          >
            <AppText
              variant="bodyMd"
              style={[styles.segmentText, isCustom && styles.segmentTextActive]}
            >
              Custom
            </AppText>
          </TouchableOpacity>
        </View>
        {isCustom && (
          <TextInput
            style={styles.customInput}
            value={customBar}
            onChangeText={setCustomBar}
            keyboardType="decimal-pad"
            placeholder="e.g. 10"
            placeholderTextColor={Colors.textMuted}
          />
        )}

        {/* Plates */}
        <AppText variant="labelMono" upper color={Colors.textMuted} style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>
          Plates Available
        </AppText>
        <View style={styles.grid}>
          {ALL_PLATE_SIZES.map((p) => {
            const active = plates.has(p);
            return (
              <TouchableOpacity
                key={p}
                style={[styles.plateChip, active && styles.plateChipActive]}
                onPress={() => togglePlate(p)}
              >
                <AppText style={[styles.plateText, active && styles.plateTextActive]}>
                  {p % 1 === 0 ? `${p}` : `${p}`} kg
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        <AppText variant="labelMono" color={Colors.textMuted} style={styles.hint}>
          Plates are always loaded in pairs — one per side.
        </AppText>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <AppText variant="bodyMd" color={Colors.white} style={{ fontFamily: Fonts.sansBold }}>
            SAVE
          </AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  title: { fontSize: FontSize.sm },
  scroll: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  sectionLabel: { marginBottom: Spacing.sm },
  segmentRow: { flexDirection: 'row', gap: Spacing.sm },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentText: { fontFamily: Fonts.sansMedium, color: Colors.textPrimary },
  segmentTextActive: { color: Colors.white },
  customInput: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: Fonts.mono,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  plateChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  plateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  plateText: { fontFamily: Fonts.monoMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  plateTextActive: { color: Colors.white },
  hint: { marginTop: Spacing.md, fontSize: 11 },
  footer: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
});
