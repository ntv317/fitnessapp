import { createContext } from 'react';
import type { IWorkoutRepository } from '@/features/workout/services/IWorkoutRepository';

/**
 * Provides the concrete repository down the tree without exposing SQLite.
 * Swap the value in tests to inject a mock repo — no component changes needed.
 */
export const RepositoryContext = createContext<IWorkoutRepository | null>(null);
