import React from 'react';
import Svg, { Circle, Rect, Path, Ellipse } from 'react-native-svg';
import { Colors } from '@/core/theme';
import type { MuscleGroup } from '../utils/muscleGroups';

interface MuscleMapIconProps {
  group: MuscleGroup;
  size?: number;
  /** Highlight color for the target muscle. Defaults to the brand primary. */
  accent?: string;
  /** Base silhouette color. */
  base?: string;
}

// Which region keys light up for each group. The figure is a single front-
// facing silhouette; only the highlighted region(s) change per group, so all
// nine icons stay visually consistent (same body, different muscle lit).
const HIGHLIGHT: Record<MuscleGroup, readonly string[]> = {
  Abs: ['abs'],
  Back: ['latL', 'latR', 'trapL', 'trapR'],
  Biceps: ['armL', 'armR'],
  Calf: ['calfL', 'calfR'],
  Chest: ['chestL', 'chestR'],
  Forearms: ['foreL', 'foreR'],
  Legs: ['thighL', 'thighR'],
  Shoulders: ['deltL', 'deltR'],
  Triceps: ['armL', 'armR'],
};

// Per-group crop window (x y w h) into the full 100×104 figure, so each icon
// zooms to just the working part instead of showing the whole body. Squares,
// so they fill the square icon frame without letterboxing. Biceps frames the
// left arm and Triceps the right, giving the two arm groups distinct icons.
const VIEWBOX: Record<MuscleGroup, string> = {
  Abs: '34 31 32 32',
  Back: '29 13 42 42',
  Biceps: '14 21 32 32',
  Calf: '36 76 28 28',
  Chest: '33 18 34 34',
  Forearms: '11 41 30 30',
  Legs: '34 56 32 32',
  Shoulders: '15 15 26 26',
  Triceps: '54 21 32 32',
};

/**
 * Anatomical muscle-map icon: a grey humanoid silhouette with the group's
 * target muscle filled in the accent color. Drawn entirely in SVG — no bundled
 * image assets, fully owned/commercial-safe.
 */
export function MuscleMapIcon({
  group,
  size = 32,
  accent = Colors.primary,
  base = '#b4aca9',
}: MuscleMapIconProps) {
  const on = HIGHLIGHT[group];
  const fill = (key: string) => (on.includes(key) ? accent : base);

  return (
    <Svg width={size} height={size} viewBox={VIEWBOX[group]}>
      {/* Head + neck (never highlighted) */}
      <Circle cx={50} cy={12} r={7} fill={base} />
      <Rect x={46.5} y={17} width={7} height={5} rx={2} fill={base} />

      {/* Unified torso silhouette behind the region shapes so it always reads
          as one solid body when nothing in the torso is lit. */}
      <Path
        d="M38 25 Q34 26 34 33 L35 50 Q36 55 41 56 L59 56 Q64 55 65 50 L66 33 Q66 26 62 25 Z"
        fill={base}
      />
      <Path d="M41 56 L59 56 L57 63 L43 63 Z" fill={base} />

      {/* Traps (back) */}
      <Path d="M43 20 L34 25 L40 28 L47 23 Z" fill={fill('trapL')} />
      <Path d="M57 20 L66 25 L60 28 L53 23 Z" fill={fill('trapR')} />

      {/* Shoulders / delts */}
      <Ellipse cx={31} cy={29} rx={8} ry={6.5} fill={fill('deltL')} />
      <Ellipse cx={69} cy={29} rx={8} ry={6.5} fill={fill('deltR')} />

      {/* Upper arms (biceps / triceps) */}
      <Rect x={23} y={32} width={8} height={17} rx={4} fill={fill('armL')} />
      <Rect x={69} y={32} width={8} height={17} rx={4} fill={fill('armR')} />

      {/* Forearms */}
      <Rect x={22} y={49} width={7.5} height={16} rx={3.5} fill={fill('foreL')} />
      <Rect x={70.5} y={49} width={7.5} height={16} rx={3.5} fill={fill('foreR')} />

      {/* Chest (pecs) */}
      <Rect x={37} y={27} width={11.5} height={12} rx={3} fill={fill('chestL')} />
      <Rect x={51.5} y={27} width={11.5} height={12} rx={3} fill={fill('chestR')} />

      {/* Lats (back) — invisible against the torso until lit */}
      <Path d="M35 33 L38 33 L40 51 L36 49 Z" fill={fill('latL')} />
      <Path d="M65 33 L62 33 L60 51 L64 49 Z" fill={fill('latR')} />

      {/* Abs */}
      <Rect x={41} y={40} width={18} height={15} rx={3} fill={fill('abs')} />

      {/* Upper legs (quads) */}
      <Rect x={41} y={62} width={8} height={20} rx={4} fill={fill('thighL')} />
      <Rect x={51} y={62} width={8} height={20} rx={4} fill={fill('thighR')} />

      {/* Lower legs (calves) */}
      <Rect x={42} y={82} width={7} height={17} rx={3.4} fill={fill('calfL')} />
      <Rect x={51} y={82} width={7} height={17} rx={3.4} fill={fill('calfR')} />
    </Svg>
  );
}
