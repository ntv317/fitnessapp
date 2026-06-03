import React from 'react';
import { View, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radius } from '@/core/theme';
import { AppText } from './AppText';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedTabsProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** Pill-shaped segmented control (e.g. MAX / VOL). Active pill fills with accent. */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  color = Colors.primary,
  style,
}: SegmentedTabsProps<T>) {
  return (
    <View style={[{ flexDirection: 'row', gap: 6 }, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: Radius.full,
              backgroundColor: active ? color : Colors.surfaceAlt,
            }}
          >
            <AppText
              variant="labelMono"
              upper
              color={active ? Colors.white : Colors.textSecondary}
            >
              {opt.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
