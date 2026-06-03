import { useContext } from 'react';
import { RepositoryContext } from '@/core/context/RepositoryContext';

/**
 * Convenience hook — throws a clear error if used outside RepositoryProvider.
 */
export function useRepository() {
  const repo = useContext(RepositoryContext);
  if (!repo) {
    throw new Error('useRepository must be used inside <RepositoryProvider>');
  }
  return repo;
}
