import React, { useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing } from '@/core/theme';
import { AppText, Button } from '@/core/ui';
import { ImageCarousel } from '../components/ImageCarousel';
import { getById } from '../services/ExerciseCatalog';
import { useExerciseByCatalogId, useUpsertExercise } from '@/features/workout/hooks/useExercises';

const MARGIN = 20;

export default function LibraryExerciseScreen() {
  const router = useRouter();
  const { catalogId } = useLocalSearchParams<{ catalogId: string }>();
  const catalogExercise = useMemo(() => getById(catalogId), [catalogId]);
  const { data: linkedExercise, isLoading } = useExerciseByCatalogId(catalogId);
  const { mutateAsync: upsertExercise, isPending } = useUpsertExercise();

  if (!catalogExercise) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.appBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.notFound}>
          <AppText variant="bodyMd" color={Colors.textMuted} center>Exercise not found.</AppText>
        </View>
      </SafeAreaView>
    );
  }

  const handleStart = async () => {
    const exercise = await upsertExercise({
      name: catalogExercise.name,
      isCompound: catalogExercise.mechanic === 'compound',
      isCustom: false,
      catalogId: catalogExercise.id,
      defaultRestSeconds: catalogExercise.mechanic === 'compound' ? 150 : 75,
      keepExistingSettings: true,
    });
    router.push({ pathname: '/exercise/[id]', params: { id: String(exercise.id) } } as never);
  };

  const handleView = () => {
    if (!linkedExercise) return;
    router.push({ pathname: '/exercise/[id]', params: { id: String(linkedExercise.id) } } as never);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <AppText variant="headlineMd" style={{ flex: 1, marginLeft: Spacing.sm }} numberOfLines={1}>
          {catalogExercise.name}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ImageCarousel images={catalogExercise.images} instructions={catalogExercise.instructions} />

        <View style={styles.metaRow}>
          <AppText variant="labelMono" upper color={Colors.textMuted}>
            {catalogExercise.mechanic === 'compound' ? 'Compound' : 'Isolation'}
          </AppText>
          {catalogExercise.equipment && (
            <AppText variant="labelMono" upper color={Colors.textMuted}>
              {catalogExercise.equipment}
            </AppText>
          )}
        </View>

        <View style={styles.actionArea}>
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : linkedExercise ? (
            <Button label="View history" onPress={handleView} variant="primary" />
          ) : (
            <Button
              label={isPending ? 'Starting…' : 'Start logging'}
              onPress={handleStart}
              variant="primary"
              disabled={isPending}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: MARGIN,
    paddingVertical: Spacing.md,
  },
  scroll: { paddingBottom: 64 },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingHorizontal: MARGIN,
    marginTop: Spacing.md,
  },
  actionArea: { paddingHorizontal: MARGIN, marginTop: Spacing.xl },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: MARGIN },
});
