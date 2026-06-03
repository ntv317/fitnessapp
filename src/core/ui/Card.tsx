import React from 'react';
import { View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '@/core/theme';

interface CardProps extends ViewProps {
  /** Left accent bar color (e.g. per-day color). Omit for a plain card. */
  accent?: string;
  /** Use the sunken/grouped fill instead of pure white. */
  sunken?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Flat container — 1px hairline border, no drop shadow (tonal-layering aesthetic).
 * Optional left accent bar for categorized cards.
 */
export function Card({ accent, sunken, padded = true, style, children, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: sunken ? Colors.surfaceSunken : Colors.surface,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: Colors.border,
          overflow: 'hidden',
        },
        accent != null && {
          borderLeftWidth: 4,
          borderLeftColor: accent,
        },
        padded && { padding: Spacing.md },
        style,
      ]}
    >
      {children}
    </View>
  );
}
