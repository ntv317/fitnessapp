import { TextStyle } from 'react-native';

// ── Kinetic Mono palette ─────────────────────────────────────────────────────
// Warm off-white surfaces, deep brick-orange primary, surgical blue/green accents.
// Existing token names are preserved so consumers keep working; values retuned.

export const Colors = {
  background: '#fcf9f8',       // warm off-white canvas
  surface: '#ffffff',          // card / container fill
  surfaceAlt: '#f0eded',       // input fill, subtle fills
  surfaceSunken: '#f6f3f2',    // very light grouped sections

  primary: '#a83300',          // brick orange-red (actions, timers)
  primaryDark: '#832600',      // pressed / variant
  primaryTint: '#ffdbd0',      // soft primary wash

  secondary: '#0058bc',        // informational blue
  tertiary: '#006b27',         // growth / PR green

  success: '#006b27',          // completed state (== tertiary)
  warning: '#b3560a',
  danger: '#ba1a1a',

  textPrimary: '#1c1b1b',      // near-black charcoal
  textSecondary: '#5c4037',    // warm brown-gray
  textMuted: '#907065',        // muted outline tone
  border: '#e5e2e1',           // 1px hairline stroke
  white: '#ffffff',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  hero: 36,
} as const;

export const Radius = {
  sm: 4,    // buttons, inputs (soft 0.25rem)
  md: 8,    // cards, large containers (0.5rem)
  lg: 12,   // framed containers (0.75rem)
  full: 9999,
} as const;

// ── Fonts ─────────────────────────────────────────────────────────────────────
// Family-name strings must match the keys registered in useFonts (see fonts.ts).

export const Fonts = {
  sans: 'HankenGrotesk_400Regular',
  sansMedium: 'HankenGrotesk_500Medium',
  sansSemibold: 'HankenGrotesk_600SemiBold',
  sansBold: 'HankenGrotesk_700Bold',
  sansBlack: 'HankenGrotesk_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

// ── Typography presets ──────────────────────────────────────────────────────
// RN letterSpacing is in px (design em × fontSize). Spread into a Text style.

export const Typography = {
  displayTimer: {
    fontFamily: Fonts.sansBold,
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: -2,
  },
  headlineLg: {
    fontFamily: Fonts.sansBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  headlineMd: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 20,
    lineHeight: 28,
  },
  bodyLg: {
    fontFamily: Fonts.sansMedium,
    fontSize: 18,
    lineHeight: 26,
  },
  bodyMd: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  bodySm: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  labelMono: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
  },
  dataInput: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 24,
    lineHeight: 32,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof Typography;
