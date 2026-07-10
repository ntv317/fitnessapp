import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WatchSync from '../../../modules/watch-sync';
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import { REVENUECAT_API_KEY_IOS, ENTITLEMENT_PRO, DEV_FORCE_PRO, PAYWALL_ENABLED } from '@/core/config/revenuecat';

// Removed spoofable entitlement mirror (see docs/SECURITY_REVIEW.md); purged on mount.
const LEGACY_PRO_CACHE_KEY = '@fitness/isPro';

// While the paywall is disabled, everyone is Pro and RevenueCat is bypassed.
const freeForAll = !PAYWALL_ENABLED;
const proByDefault = freeForAll || (__DEV__ && DEV_FORCE_PRO);

// Loaded lazily so jest (no native module) degrades to the cached value.
type PurchasesModule = typeof import('react-native-purchases').default;
function getPurchases(): PurchasesModule | null {
  try {
    return require('react-native-purchases').default;
  } catch {
    return null;
  }
}

interface PremiumContextValue {
  isPro: boolean;
  isLoading: boolean;
  offerings: PurchasesOfferings | null;
  purchase: (pkg: PurchasesPackage) => Promise<void>;
  restore: () => Promise<boolean>;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

function hasPro(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_PRO] !== undefined;
}

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);

  const applyCustomerInfo = useCallback((info: CustomerInfo) => {
    const pro = hasPro(info);
    setIsPro(pro);
    // Single writer of the watch lock flag. Only fires once entitlement is
    // actually known, so a paying user never sees a cold-start lock flicker.
    WatchSync?.updateState({ premiumRequired: !(pro || proByDefault) });
  }, []);

  useEffect(() => {
    AsyncStorage.removeItem(LEGACY_PRO_CACHE_KEY).catch(() => {});

    // Paywall off: unlock the watch and skip RevenueCat entirely (no key needed).
    if (freeForAll) {
      WatchSync?.updateState({ premiumRequired: false });
      setIsLoading(false);
      return;
    }

    const Purchases = getPurchases();
    if (!Purchases || !REVENUECAT_API_KEY_IOS) {
      // Entitlement can never be confirmed in this configuration, so assert
      // the watch lock instead of leaving its last state in place.
      WatchSync?.updateState({ premiumRequired: !proByDefault });
      setIsLoading(false);
      return;
    }

    Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
    const listener = (info: CustomerInfo) => applyCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);

    Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()])
      .then(([info, offs]) => {
        applyCustomerInfo(info);
        setOfferings(offs);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo]);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    const Purchases = getPurchases();
    if (!Purchases) throw new Error('Purchases unavailable');
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(customerInfo);
  }, [applyCustomerInfo]);

  const restore = useCallback(async () => {
    const Purchases = getPurchases();
    if (!Purchases) throw new Error('Purchases unavailable');
    const info = await Purchases.restorePurchases();
    applyCustomerInfo(info);
    return hasPro(info);
  }, [applyCustomerInfo]);

  const value = useMemo<PremiumContextValue>(
    () => ({ isPro: proByDefault || isPro, isLoading, offerings, purchase, restore }),
    [isPro, isLoading, offerings, purchase, restore],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used within a PremiumProvider');
  return ctx;
}
