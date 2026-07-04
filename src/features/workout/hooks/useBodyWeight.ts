import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from './useRepository';

export const BODYWEIGHT_KEY = ['bodyweight'] as const;

export function useBodyWeight(limit = 60) {
  const repo = useRepository();
  return useQuery({
    queryKey: BODYWEIGHT_KEY,
    queryFn: () => repo.getBodyWeightHistory(limit),
  });
}

export function useLogBodyWeight() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weightKg: number) => repo.logBodyWeight(weightKg, Date.now()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BODYWEIGHT_KEY });
    },
  });
}

export function useDeleteBodyWeight() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => repo.deleteBodyWeight(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BODYWEIGHT_KEY });
    },
  });
}
