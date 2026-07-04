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

/** Aggregate volume/sets/days for the week starting at weekStart. */
export function useWeeklyStats(weekStart: number) {
  const repo = useRepository();
  return useQuery({
    queryKey: ['stats', weekStart] as const,
    queryFn: () => repo.getWeeklyStats(weekStart),
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
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

/** Edit an already-logged set's reps/weight (kg). */
export function useUpdateSet() {
  const repo = useRepository();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ logId, setOrder, reps, weight, rpe = null, note = null }: { logId: number; setOrder: number; reps: number; weight: number; rpe?: number | null; note?: string | null }) =>
      repo.updateSet(logId, setOrder, reps, weight, rpe, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['history'] });
      qc.invalidateQueries({ queryKey: ['weekly'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

/** Delete one logged set (compacts ordering, rolls back its weekly count). */
export function useDeleteSet() {
  const repo = useRepository();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ logId, setOrder }: { logId: number; setOrder: number }) => repo.deleteSet(logId, setOrder),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['history'] });
      qc.invalidateQueries({ queryKey: ['weekly'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

/**
 * Auto-save hook: creates a log on first set, then appends subsequent sets.
 * Returns { saveSet, resetLogCache }. `resetLogCache` is a fast-path hint for
 * callers that know they just emptied today's log (skips a wasted lookup) —
 * but `saveSet` itself is now self-healing: if the cached log id is stale
 * (e.g. the log was deleted elsewhere, like the History screen, while this
 * screen kept its own cache), the FOREIGN KEY failure triggers one retry that
 * drops the cache and re-resolves the log id before giving up.
 */
export function useAutoSaveSet() {
  const repo = useRepository();
  const qc = useQueryClient();
  const logIdRef = useRef<Map<string, number>>(new Map());

  const resolveLogId = useCallback(async (
    cacheKey: string,
    exerciseId: number,
    dayTag: string | null,
  ) => {
    const existing = await repo.getTodayLogId(exerciseId, dayTag);
    const logId = existing ?? (await repo.createLog(exerciseId, Date.now(), dayTag));
    logIdRef.current.set(cacheKey, logId);
    return logId;
  }, [repo]);

  const saveSet = useCallback(async (
    exerciseId: number,
    setOrder: number,
    reps: number,
    weight: number,
    dayTag: string | null,
    rpe: number | null = null,
    note: string | null = null,
  ) => {
    const cacheKey = `${exerciseId}|${dayTag ?? ''}`;
    let logId = logIdRef.current.get(cacheKey) ?? (await resolveLogId(cacheKey, exerciseId, dayTag));
    try {
      await repo.appendSet(logId, exerciseId, setOrder, reps, weight, dayTag, rpe, note);
    } catch (err) {
      // Most likely cause: another screen deleted this log out from under us
      // and our cache didn't know. Drop the stale id, re-resolve, retry once.
      logIdRef.current.delete(cacheKey);
      logId = await resolveLogId(cacheKey, exerciseId, dayTag);
      await repo.appendSet(logId, exerciseId, setOrder, reps, weight, dayTag, rpe, note);
    }
    qc.invalidateQueries({ queryKey: ['history'] });
    qc.invalidateQueries({ queryKey: ['weekly'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  }, [repo, qc, resolveLogId]);

  const resetLogCache = useCallback((exerciseId: number, dayTag: string | null) => {
    logIdRef.current.delete(`${exerciseId}|${dayTag ?? ''}`);
  }, []);

  return { saveSet, resetLogCache };
}
