import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { RepositoryContext } from '@/core/context/RepositoryContext';
import { DatabaseLifecycleContext } from '@/core/context/DatabaseLifecycleContext';
import { UnitProvider } from '@/core/context/UnitContext';
import { PremiumProvider } from '@/core/context/PremiumContext';
import { WorkoutRepository } from '@/features/workout/services/WorkoutRepository';
import { getDatabase } from '@/core/database/db';
import { Colors, Fonts } from '@/core/theme';
import { fontMap } from '@/core/theme/fonts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [repo, setRepo] = useState<WorkoutRepository | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dbEpoch, setDbEpoch] = useState(0);
  const [fontsLoaded, fontError] = useFonts(fontMap);

  useEffect(() => {
    getDatabase()
      .then((db) => setRepo(new WorkoutRepository(db)))
      .catch((e) => setError(String(e)));
  }, [dbEpoch]);

  const lifecycle = useMemo(
    () => ({
      suspendDatabase: () => setRepo(null),
      reloadDatabase: () => {
        setRepo(null);
        setDbEpoch((e) => e + 1);
      },
    }),
    [],
  );

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>DB init failed: {error}</Text>
      </View>
    );
  }

  // Don't block forever on a font failure — fall back to system fonts.
  const ready = repo && (fontsLoaded || fontError);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PremiumProvider>
          <UnitProvider>
            <DatabaseLifecycleContext.Provider value={lifecycle}>
              <RepositoryContext.Provider value={repo}>
                {children}
              </RepositoryContext.Provider>
            </DatabaseLifecycleContext.Provider>
          </UnitProvider>
        </PremiumProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    fontFamily: Fonts.sans,
    textAlign: 'center',
    padding: 24,
  },
});
