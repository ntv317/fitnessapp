import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@trak/barbell_config';

export const ALL_PLATE_SIZES = [0.5, 1.25, 2.5, 5, 10, 15, 20, 25] as const;
export const ALL_PLATE_SIZES_LB = [2.5, 5, 10, 25, 35, 45] as const;
export const LB_TO_KG = 0.453592;
export const KG_TO_LB = 2.20462;

export interface BarbellConfig {
  barWeight: number;
  plates: number[];
}

const DEFAULT_CONFIG: BarbellConfig = {
  barWeight: 20,
  plates: [2.5, 5, 10, 15, 20, 25],
};

export function useBarbellConfig() {
  const [config, setConfig] = useState<BarbellConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setConfig(JSON.parse(raw)); } catch { /* keep default */ }
      }
      setLoaded(true);
    });
  }, []);

  const saveConfig = useCallback(async (next: BarbellConfig) => {
    setConfig(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  return { config, loaded, saveConfig };
}
