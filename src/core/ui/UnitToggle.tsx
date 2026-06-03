import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Colors, Radius } from '@/core/theme';
import { useUnit } from '@/core/context/UnitContext';
import { AppText } from './AppText';

/** Compact KG/LBS toggle pill — flips the global weight-unit preference. */
export function UnitToggle() {
  const { unit, toggle } = useUnit();
  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: Radius.full,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.surfaceAlt,
      }}
    >
      <AppText variant="labelMono" upper color={Colors.textSecondary}>
        {unit}
      </AppText>
    </TouchableOpacity>
  );
}
