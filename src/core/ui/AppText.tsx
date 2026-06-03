import React from 'react';
import { Text, type TextProps, type StyleProp, type TextStyle } from 'react-native';
import { Colors, Typography, type TypographyVariant } from '@/core/theme';

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  /** Uppercase + mono spacing — convenience for `labelMono` headers. */
  upper?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * Single source of truth for text styling. Always renders with a themed
 * font family + color so the app never falls back to the platform default.
 */
export function AppText({
  variant = 'bodyMd',
  color = Colors.textPrimary,
  upper,
  center,
  style,
  children,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        Typography[variant],
        { color },
        upper && { textTransform: 'uppercase' },
        center && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
