import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { useRepository } from './useRepository';

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
      qc.invalidateQueries({ queryKey: ['weekly'] });
    },
  });
}

/**
 * Auto-save hook: creates a log on first set, then appends subsequent sets.
 * Returns a saveSet(exerciseId, setOrder, reps, weight, dayTag) function.
 */
export function useAutoSaveSet() {
  const repo = useRepository();
  const qc = useQueryClient();
  const logIdRef = useRef<Map<string, number>>(new Map());

  const saveSet = useCallback(async (
    exerciseId: number,
    setOrder: number,
    reps: number,
    weight: number,
    dayTag: string | null,
  ) => {
    const cacheKey = `${exerciseId}|${dayTag ?? ''}`;
    let logId = logIdRef.current.get(cacheKey);
    if (!logId) {
      const existing = await repo.getTodayLogId(exerciseId, dayTag);
      if (existing) {
        logId = existing;
      } else {
        logId = await repo.createLog(exerciseId, Date.now(), dayTag);
      }
      logIdRef.current.set(cacheKey, logId);
    }
    await repo.appendSet(logId, exerciseId, setOrder, reps, weight, dayTag);
    qc.invalidateQueries({ queryKey: ['history'] });
    qc.invalidateQueries({ queryKey: ['weekly'] });
  }, [repo, qc]);

  return saveSet;
}
