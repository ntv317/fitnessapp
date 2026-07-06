// Public SDK key from RevenueCat → Project Settings → API Keys (appl_...).
// Empty string leaves the SDK unconfigured: isPro stays false and purchases
// are disabled until a key is set.
export const REVENUECAT_API_KEY_IOS = '';

export const ENTITLEMENT_PRO = 'pro';

// Grants Pro in __DEV__ builds only (compiled out of release). Set false to
// test the free/locked experience locally.
export const DEV_FORCE_PRO = true;

export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const PRIVACY_URL = 'https://ntv317.github.io/fitnessapp/privacy-policy.html';

export const PRODUCT_IDS = {
  monthly: 'io.liftr.app.pro.monthly',
  yearly: 'io.liftr.app.pro.yearly',
  lifetime: 'io.liftr.app.pro.lifetime',
} as const;
