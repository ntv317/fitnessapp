import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type WeightUnit = 'kg' | 'lbs';

const STORAGE_KEY = '@fitness/weightUnit';
const CONVERSION_KEY = '@fitness/showConversion';
const KG_PER_LB = 0.45359237;
const LB_PER_KG = 1 / KG_PER_LB;

interface UnitContextValue {
  unit: WeightUnit;
  setUnit: (u: WeightUnit) => void;
  toggle: () => void;
  /** Convert a canonical kg value → number in the active unit (rounded to .5). */
  fromKg: (kg: number) => number;
  /** Convert a value typed in the active unit → canonical kg for storage. */
  toKg: (value: number) => number;
  /** Format a canonical kg value as a display string (no unit suffix). */
  display: (kg: number) => string;
  label: WeightUnit;
  /** Whether to show the secondary-unit conversion hint alongside weights. */
  showConversion: boolean;
  toggleConversion: () => void;
  /** Returns "≈ X lbs" or "≈ X kg" for a value already in the display unit. Null when disabled or value ≤ 0. */
  conversionHint: (displayUnitValue: number) => string | null;
}

const UnitContext = createContext<UnitContextValue | null>(null);

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnitState] = useState<WeightUnit>('kg');
  const [showConversion, setShowConversion] = useState(false);

  // Hydrate persisted preferences once.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => { if (v === 'kg' || v === 'lbs') setUnitState(v); })
      .catch(() => {});
    AsyncStorage.getItem(CONVERSION_KEY)
      .then((v) => { if (v === 'true') setShowConversion(true); })
      .catch(() => {});
  }, []);

  const setUnit = useCallback((u: WeightUnit) => {
    setUnitState(u);
    AsyncStorage.setItem(STORAGE_KEY, u).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setUnitState((prev) => {
      const next = prev === 'kg' ? 'lbs' : 'kg';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const toggleConversion = useCallback(() => {
    setShowConversion((prev) => {
      const next = !prev;
      AsyncStorage.setItem(CONVERSION_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<UnitContextValue>(() => {
    const fromKg = (kg: number) => (unit === 'kg' ? kg : roundHalf(kg * LB_PER_KG));
    const toKg = (v: number) => (unit === 'kg' ? v : v * KG_PER_LB);
    const display = (kg: number) => {
      const n = fromKg(kg);
      return n % 1 === 0 ? String(n) : n.toFixed(1);
    };
    const conversionHint = (val: number): string | null => {
      if (!showConversion || val <= 0) return null;
      if (unit === 'kg') return `≈ ${Math.round(val * LB_PER_KG)} lbs`;
      return `≈ ${(Math.round(val * KG_PER_LB * 10) / 10)} kg`;
    };
    return { unit, setUnit, toggle, fromKg, toKg, display, label: unit, showConversion, toggleConversion, conversionHint };
  }, [unit, setUnit, toggle, showConversion, toggleConversion]);

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

export function useUnit(): UnitContextValue {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error('useUnit must be used within a UnitProvider');
  return ctx;
}
