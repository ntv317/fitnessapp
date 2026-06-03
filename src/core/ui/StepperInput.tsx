import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
  type KeyboardTypeOptions,
} from 'react-native';
import { Colors, Fonts, Radius, Typography } from '@/core/theme';
import { AppText } from './AppText';

interface StepperInputProps {
  /** Current value as a string (the field is free-text editable). */
  value: string;
  onChangeText: (text: string) => void;
  /** Amount added/subtracted by the +/− buttons. */
  step?: number;
  min?: number;
  placeholder?: string;
  editable?: boolean;
  color?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Allow decimals when stepping/parsing (weights) vs integers (reps). */
  decimal?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Combined stepper + text field: − [editable value] +
 * The center is a real TextInput so users can type OR tap the steppers.
 */
export function StepperInput({
  value,
  onChangeText,
  step = 1,
  min = 0,
  placeholder = '0',
  editable = true,
  color = Colors.primary,
  keyboardType,
  decimal = false,
  style,
}: StepperInputProps) {
  const bump = (dir: 1 | -1) => {
    const current = parseFloat(value) || 0;
    const next = Math.max(min, current + dir * step);
    const rounded = decimal ? Math.round(next * 2) / 2 : Math.round(next);
    onChangeText(String(rounded));
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: editable ? Colors.surfaceAlt : Colors.surfaceSunken,
          borderRadius: Radius.sm,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <TouchableOpacity
        onPress={() => bump(-1)}
        disabled={!editable}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        style={stepBtn}
        activeOpacity={0.6}
      >
        <AppText variant="headlineMd" color={editable ? color : Colors.textMuted}>−</AppText>
      </TouchableOpacity>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType ?? (decimal ? 'decimal-pad' : 'number-pad')}
        editable={editable}
        selectTextOnFocus
        style={{
          flex: 1,
          textAlign: 'center',
          paddingVertical: 8,
          ...Typography.dataInput,
          fontFamily: Fonts.sansSemibold,
          color: Colors.textPrimary,
        }}
      />

      <TouchableOpacity
        onPress={() => bump(1)}
        disabled={!editable}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        style={stepBtn}
        activeOpacity={0.6}
      >
        <AppText variant="headlineMd" color={editable ? color : Colors.textMuted}>+</AppText>
      </TouchableOpacity>
    </View>
  );
}

const stepBtn: ViewStyle = {
  width: 40,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'stretch',
};
