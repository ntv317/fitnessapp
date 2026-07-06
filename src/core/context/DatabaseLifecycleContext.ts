import { createContext, useContext } from 'react';

interface DatabaseLifecycleValue {
  /** Unmounts repository consumers so no new writes dispatch during a restore swap. */
  suspendDatabase: () => void;
  /** Re-opens the DB and rebuilds the repository (used after an iCloud restore). */
  reloadDatabase: () => void;
}

export const DatabaseLifecycleContext = createContext<DatabaseLifecycleValue>({
  suspendDatabase: () => {},
  reloadDatabase: () => {},
});

export function useDatabaseLifecycle(): DatabaseLifecycleValue {
  return useContext(DatabaseLifecycleContext);
}
