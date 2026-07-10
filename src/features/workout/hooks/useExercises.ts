import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from './useRepository';
import type { CustomExerciseInput, ExerciseInput, ExercisePatch } from '@/core/database/types';

export const EXERCISES_KEY = ['exercises'] as const;

export function useExercises() {
  const repo = useRepository();

  return useQuery({
    queryKey: EXERCISES_KEY,
    queryFn: () => repo.getAllExercises(),
    staleTime: 5 * 60 * 1000, // 5 min — exercise list changes rarely
  });
}

export function useExerciseByCatalogId(catalogId: string | undefined) {
  const repo = useRepository();
  return useQuery({
    queryKey: ['exercises', 'catalog', catalogId],
    queryFn: () => repo.getExerciseByCatalogId(catalogId!),
    enabled: !!catalogId,
  });
}

export function useAllDays() {
  const repo = useRepository();
  return useQuery({
    queryKey: ['exercises', 'all-days'],
    queryFn: () => repo.getAllDays(),
  });
}

export function useUpsertExercise() {
  const repo = useRepository();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: ExerciseInput) => repo.upsertExercise(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXERCISES_KEY });
    },
  });
}

export function useCreateCustomExercise() {
  const repo = useRepository();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CustomExerciseInput) => repo.createCustomExercise(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXERCISES_KEY });
    },
  });
}

export function useUpdateExercise() {
  const repo = useRepository();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: ExercisePatch }) => repo.updateExercise(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXERCISES_KEY });
    },
  });
}

export function useCreateOrUpdateCatalogOverride() {
  const repo = useRepository();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ catalogId, patch }: { catalogId: string; patch: ExercisePatch }) =>
      repo.createOrUpdateCatalogOverride(catalogId, patch),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: EXERCISES_KEY });
      qc.invalidateQueries({ queryKey: ['exercises', 'catalog', variables.catalogId] });
    },
  });
}

export function useResetExerciseOverride() {
  const repo = useRepository();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      canonical,
    }: {
      id: number;
      canonical: { name: string; isCompound: boolean; muscleGroup: string | null };
    }) => repo.resetExerciseOverride(id, canonical),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXERCISES_KEY });
    },
  });
}

export function useDeleteCustomExercise() {
  const repo = useRepository();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => repo.deleteCustomExercise(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXERCISES_KEY });
    },
  });
}

/** Wipe all exercises, days, logs, and sets — full reset to an empty database. */
export function useClearHistory() {
  const repo = useRepository();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => repo.clearHistory(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      qc.invalidateQueries({ queryKey: ['history'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useClearAllData() {
  const repo = useRepository();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => repo.clearAllData(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      qc.invalidateQueries({ queryKey: ['history'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['bodyweight'] });
    },
  });
}
