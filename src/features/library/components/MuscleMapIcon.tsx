import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import type { MuscleGroup } from '../utils/muscleGroups';

interface MuscleMapIconProps {
  group: MuscleGroup;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

// Anatomical muscle-group icons: solid-black figure with the target muscle lit
// in orange. Bundled PNG assets (generated in Stitch), one per group.
const ICONS: Record<MuscleGroup, number> = {
  Abs: require('../../../../assets/muscle-icons/abs.png'),
  Back: require('../../../../assets/muscle-icons/back.png'),
  Biceps: require('../../../../assets/muscle-icons/biceps.png'),
  Calf: require('../../../../assets/muscle-icons/calf.png'),
  Chest: require('../../../../assets/muscle-icons/chest.png'),
  Forearms: require('../../../../assets/muscle-icons/forearms.png'),
  Legs: require('../../../../assets/muscle-icons/legs.png'),
  Shoulders: require('../../../../assets/muscle-icons/shoulders.png'),
  Triceps: require('../../../../assets/muscle-icons/triceps.png'),
};

export function MuscleMapIcon({ group, size = 32, style }: MuscleMapIconProps) {
  return (
    <Image
      source={ICONS[group]}
      style={[{ width: size, height: size, borderRadius: size * 0.18 }, style]}
      resizeMode="cover"
    />
  );
}
