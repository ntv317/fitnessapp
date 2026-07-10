import React, { useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing } from '@/core/theme';
import { AppText, Button } from '@/core/ui';
import { ImageCarousel } from '../components/ImageCarousel';
import { getById } from '../services/ExerciseCatalog';
import { useLibraryExercise } from '../hooks/useLibraryExercise';
import { useExerciseByCatalogId, useUpsertExercise } from '@/features/workout/hooks/useExercises';

const MARGIN = 20;

export default function LibraryExerciseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { catalogId } = useLocalSearchParams<{ catalogId: string }>();
  const catalogExercise = useMemo(() => getById(catalogId), [catalogId]);
  const libraryExercise = useLibraryExercise(catalogId);
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
          <AppText variant="bodyMd" color={Colors.textMuted} center>{t('library.exerciseNotFound')}</AppText>
        </View>
      </SafeAreaView>
    );
  }

  const handleStart = async () => {
    if (linkedExercise) {
      router.push({ pathname: '/exercise/[id]', params: { id: String(linkedExercise.id) } } as never);
      return;
    }
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
          {libraryExercise?.name ?? catalogExercise.name}
        </AppText>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/library/exercise-form', params: { catalogId } } as never)}
          hitSlop={10}
        >
          <Ionicons name="pencil" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ImageCarousel
          images={
            libraryExercise?.imageUris && libraryExercise.imageUris.length > 0
              ? libraryExercise.imageUris
              : catalogExercise.images
          }
          instructions={libraryExercise?.instructions ?? catalogExercise.instructions}
        />

        <View style={styles.metaRow}>
          <AppText variant="labelMono" upper color={Colors.textMuted}>
            {t(catalogExercise.mechanic === 'compound' ? 'exerciseMeta.mechanic.compound' : 'exerciseMeta.mechanic.isolation')}
          </AppText>
          {catalogExercise.equipment && (
            <AppText variant="labelMono" upper color={Colors.textMuted}>
              {t(`exerciseMeta.equipment.${catalogExercise.equipment}`, { defaultValue: catalogExercise.equipment })}
            </AppText>
          )}
        </View>

        <View style={styles.actionArea}>
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : linkedExercise ? (
            <Button label={t('library.viewHistory')} onPress={handleView} variant="primary" />
          ) : (
            <Button
              label={isPending ? t('library.starting') : t('library.startLogging')}
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
