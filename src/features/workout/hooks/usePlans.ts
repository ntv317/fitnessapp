import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from './useRepository';

export const PLANS_KEY = ['plans'] as const;

export function usePlans() {
  const repo = useRepository();
  return useQuery({
    queryKey: PLANS_KEY,
    queryFn: () => repo.getPlans(),
  });
}

export function usePlanDetail(planId: number) {
  const repo = useRepository();
  return useQuery({
    queryKey: ['plans', planId],
    queryFn: () => repo.getPlanDetail(planId),
    enabled: planId > 0,
  });
}

// Plan/day/exercise structure changes invalidate both the plans list (detail
// screens) and the exercises family (Log tab's getAllDays/getExercisesByDay
// resolve through the active plan, so they must refresh too).
function usePlanMutation<TInput, TOutput>(mutationFn: (input: TInput) => Promise<TOutput>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLANS_KEY });
      qc.invalidateQueries({ queryKey: ['exercises'] });
    },
  });
}

export function useCreatePlan() {
  const repo = useRepository();
  return usePlanMutation((name: string) => repo.createPlan(name));
}

export function useRenamePlan() {
  const repo = useRepository();
  return usePlanMutation(({ planId, name }: { planId: number; name: string }) => repo.renamePlan(planId, name));
}

export function useDeletePlan() {
  const repo = useRepository();
  return usePlanMutation((planId: number) => repo.deletePlan(planId));
}

export function useSetActivePlan() {
  const repo = useRepository();
  return usePlanMutation((planId: number) => repo.setActivePlan(planId));
}

export function useAddPlanDay() {
  const repo = useRepository();
  return usePlanMutation(({ planId, name }: { planId: number; name: string }) => repo.addPlanDay(planId, name));
}

export function useRenamePlanDay() {
  const repo = useRepository();
  return usePlanMutation(({ planDayId, name }: { planDayId: number; name: string }) => repo.renamePlanDay(planDayId, name));
}

export function useDeletePlanDay() {
  const repo = useRepository();
  return usePlanMutation((planDayId: number) => repo.deletePlanDay(planDayId));
}

export function useAddPlanExercise() {
  const repo = useRepository();
  return usePlanMutation(
    (input: { planDayId: number; exerciseId: number; targetSets: number; repMin?: number | null; repMax?: number | null }) =>
      repo.addPlanExercise(input.planDayId, input.exerciseId, {
        targetSets: input.targetSets,
        repMin: input.repMin,
        repMax: input.repMax,
      }),
  );
}

export function useUpdatePlanExercise() {
  const repo = useRepository();
  return usePlanMutation(
    (input: { id: number; targetSets?: number; repMin?: number | null; repMax?: number | null }) =>
      repo.updatePlanExercise(input.id, input),
  );
}

export function useRemovePlanExercise() {
  const repo = useRepository();
  return usePlanMutation((id: number) => repo.removePlanExercise(id));
}

export function useReorderPlanExercises() {
  const repo = useRepository();
  return usePlanMutation(({ planDayId, orderedIds }: { planDayId: number; orderedIds: number[] }) =>
    repo.reorderPlanExercises(planDayId, orderedIds),
  );
}
