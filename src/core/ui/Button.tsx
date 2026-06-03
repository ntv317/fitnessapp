import React from 'react';
import {
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from '@/core/theme';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  fullWidth?: boolean;
  color?: string; // override accent (defaults to primary)
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  fullWidth,
  color = Colors.primary,
  style,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';

  const bg = isPrimary ? color : 'transparent';
  const borderColor = isSecondary ? Colors.textPrimary : 'transparent';
  const textColor = isPrimary ? Colors.white : isSecondary ? Colors.textPrimary : color;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Spacing.sm,
          backgroundColor: bg,
          borderColor,
          borderWidth: isSecondary ? 1 : 0,
          borderRadius: Radius.sm,
          paddingVertical: 14,
          paddingHorizontal: Spacing.lg,
          opacity: disabled ? 0.4 : 1,
        },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={textColor} />}
      <AppText variant="bodyLg" color={textColor} style={{ fontFamily: Fonts.sansBold }}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}
