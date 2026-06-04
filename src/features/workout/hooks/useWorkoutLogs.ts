import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { useRepository } from './useRepository';
import type { LogWorkoutInput } from '@/core/database/types';

export const historyKey = (exerciseId: number) => ['history', exerciseId] as const;

/** Latest 20 logs for a given exercise. */
export function useWorkoutLogs(exerciseId: number) {
  const repo = useRepository();

  return useQuery({
    queryKey: historyKey(exerciseId),
    queryFn: () => repo.getHistory(exerciseId, { limit: 20 }),
    enabled: exerciseId > 0,
  });
}

/** All logs across every exercise, grouped by date in the UI. */
export function useAllHistory() {
  const repo = useRepository();
  return useQuery({
    queryKey: ['history', 'all'] as const,
    queryFn: () => repo.getAllHistory({ limit: 500 }),
  });
}

/** Save a new workout log; invalidates its history cache on success. */
export function useLogWorkout() {
  const repo = useRepository();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: LogWorkoutInput) => repo.logWorkout(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: historyKey(variables.exerciseId) });
    },
  });
}

/** Sets logged for each exercise in the given week (exerciseId → count). */
export function useWeeklyProgress(weekStart: number) {
  const repo = useRepository();
  return useQuery({
    queryKey: ['weekly', weekStart] as const,
    queryFn: () => repo.getWeeklyProgress(weekStart),
    staleTime: 0,
  });
}

/** Delete a log; invalidates all history queries (we don't know which exercise). */
export function useDeleteLog() {
  const repo = useRepository();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (logId: number) => repo.deleteLog(logId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

/**
 * Auto-save hook: creates a log on first set, then appends subsequent sets.
 * Returns a saveSet(exerciseId, setOrder, reps, weight) function.
 */
export function useAutoSaveSet() {
  const repo = useRepository();
  const qc = useQueryClient();
  const logIdRef = useRef<Map<number, number>>(new Map());

  const saveSet = useCallback(async (
    exerciseId: number,
    setOrder: number,
    reps: number,
    weight: number,
  ) => {
    let logId = logIdRef.current.get(exerciseId);
    if (!logId) {
      const existing = await repo.getTodayLogId(exerciseId);
      if (existing) {
        logId = existing;
      } else {
        logId = await repo.createLog(exerciseId, Date.now());
      }
      logIdRef.current.set(exerciseId, logId);
    }
    await repo.appendSet(logId, exerciseId, setOrder, reps, weight);
    qc.invalidateQueries({ queryKey: ['history'] });
    qc.invalidateQueries({ queryKey: ['weekly'] });
  }, [repo, qc]);

  return saveSet;
}
