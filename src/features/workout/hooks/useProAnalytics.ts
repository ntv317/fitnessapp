import { useQuery } from '@tanstack/react-query';
import { useRepository } from './useRepository';

// Key nests under ['stats'] so existing mutation invalidation
// (useUpdateSet, useDeleteSet, useDeleteLog) refreshes it automatically.

export function useMuscleVolume(weekStart: number, enabled: boolean) {
  const repo = useRepository();
  return useQuery({
    queryKey: ['stats', 'muscle', weekStart],
    queryFn: () => repo.getWeeklyMuscleVolume(weekStart),
    enabled,
  });
}
