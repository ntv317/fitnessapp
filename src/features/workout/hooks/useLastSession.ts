import { useQuery } from '@tanstack/react-query';
import { useRepository } from './useRepository';

/**
 * Returns the single most-recent log for an exercise.
 * Shown on the logging screen so athletes can see their last max set
 * without digging into history.
 */
export function useLastSession(exerciseId: number) {
  const repo = useRepository();

  return useQuery({
    queryKey: ['lastSession', exerciseId],
    queryFn: async () => {
      const logs = await repo.getHistory(exerciseId, { limit: 1 });
      return logs[0] ?? null;
    },
    enabled: exerciseId > 0,
  });
}
