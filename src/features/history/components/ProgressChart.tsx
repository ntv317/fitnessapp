import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import { format } from 'date-fns';
import { Colors, Spacing, FontSize, Radius } from '@/core/theme';
import { useUnit } from '@/core/context/UnitContext';
import type { WorkoutLog } from '@/core/database/types';

type Metric = 'maxWeight' | 'oneRM' | 'volume';

interface Props {
  logs: WorkoutLog[];
  color?: string;
}

const CHART_H  = 140;
const MAX_SESS = 20;
const STROKE   = 2.5;

const BASE_METRICS: { key: Metric; label: string }[] = [
  { key: 'maxWeight', label: 'Max'      },
  { key: 'oneRM',     label: 'Est. 1RM' },
  { key: 'volume',    label: 'Volume'   },
];

function epley(w: number, r: number) {
  return r <= 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10;
}

export function ProgressChart({ logs, color = Colors.primary }: Props) {
  const [metric, setMetric] = useState<Metric>('maxWeight');
  const [chartW, setChartW] = useState(0);
  const { unit: weightUnit, fromKg } = useUnit();

  const data = useMemo(() => {
    const sorted = [...logs]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-MAX_SESS);

    return sorted.map((log, i) => {
      const valid = log.sets.filter((s) => s.weight > 0 && s.reps > 0);
      if (!valid.length) return null;
      const best = valid.reduce((t, s) => (s.weight > t.weight ? s : t), valid[0]);
      const vol  = valid.reduce((sum, s) => sum + s.weight * s.reps, 0);
      return {
        session:   i,
        maxWeight: best.weight,
        oneRM:     epley(best.weight, best.reps),
        volume:    Math.round(vol),
        timestamp: log.timestamp,
      };
    }).filter(Boolean) as {
      session: number; maxWeight: number; oneRM: number;
      volume: number; timestamp: number;
    }[];
  }, [logs]);

  if (data.length < 2) return null;

  const metrics = BASE_METRICS.map((m) =>
    m.key === 'maxWeight' ? { ...m, label: `Max ${weightUnit}` } : m,
  );

  const onLayout = (e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width);

  const values = data.map((d) => d[metric]);
  const isPR   = values[values.length - 1] >= Math.max(...values.slice(0, -1));
  const yMin   = Math.min(...values);
  const yMax   = Math.max(...values);
  const yRange = yMax - yMin || yMax * 0.1 || 1;
  const yPad   = yRange * 0.22;

  const sx = (i: number) => chartW > 0 ? (i / (data.length - 1)) * chartW : 0;
  const sy = (v: number) => CHART_H - ((v - yMin + yPad) / (yRange + yPad * 2)) * CHART_H;

  const pts  = data.map((d, i) => ({ x: sx(i), y: sy(d[metric]) }));
  const last = pts[pts.length - 1];

  const labelTop  = Math.max(2, last.y - 18);
  const labelLeft = last.x > chartW * 0.7 ? last.x - 40 : last.x + 8;

  const first     = data[0];
  const lastD     = data[data.length - 1];
  const dispFirst = fromKg(first[metric]);
  const dispLast  = fromKg(lastD[metric]);
  const delta     = dispLast - dispFirst;
  const sign      = delta >= 0 ? '+' : '';
  const pct       = first[metric] > 0 ? `${sign}${((delta / dispFirst) * 100).toFixed(0)}%` : '';
  const deltaAmt  = `${sign}${Math.abs(delta) < 1 ? delta.toFixed(1) : Math.round(delta)}`;
  const unit      = metric === 'volume' ? `${weightUnit} vol` : weightUnit;
  const dColor    = delta >= 0 ? Colors.success : Colors.danger;

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={s.tabs}>
          {metrics.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[s.tab, metric === key && { backgroundColor: color + '18', borderColor: color + '60' }]}
              onPress={() => setMetric(key)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, metric === key && { color }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.badgeRow}>
          {isPR && (
            <View style={[s.prBadge, { backgroundColor: color + '18', borderColor: color + '50' }]}>
              <Text style={[s.prText, { color }]}>PR</Text>
            </View>
          )}
          <View style={[s.deltaBadge, { backgroundColor: dColor + '15' }]}>
            <Text style={[s.deltaText, { color: dColor }]}>{deltaAmt} {unit}  {pct}</Text>
          </View>
        </View>
      </View>


      <View style={{ height: CHART_H, overflow: 'hidden' }} onLayout={onLayout}>
        {chartW > 0 && (
          <>
            {[0.25, 0.5, 0.75].map((t) => (
              <View key={t} style={[s.grid, { top: CHART_H * t }]} />
            ))}

            {pts.slice(0, -1).map((p1, i) => {
              const p2  = pts[i + 1];
              const dx  = p2.x - p1.x;
              const dy  = p2.y - p1.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const deg = Math.atan2(dy, dx) * (180 / Math.PI);
              const r   = 2.5;
              return (
                <React.Fragment key={i}>
                  <View
                    style={{
                      position:        'absolute',
                      left:            p1.x,
                      top:             Math.min(p1.y, p2.y),
                      width:           p2.x - p1.x,
                      height:          CHART_H - Math.min(p1.y, p2.y),
                      backgroundColor: color,
                      opacity:         0.08,
                    }}
                  />
                  <View
                    style={{
                      position:        'absolute',
                      left:            (p1.x + p2.x) / 2 - len / 2,
                      top:             (p1.y + p2.y) / 2 - STROKE / 2,
                      width:           len,
                      height:          STROKE,
                      backgroundColor: color,
                      borderRadius:    STROKE,
                      transform:       [{ rotate: `${deg}deg` }],
                    }}
                  />
                  <View
                    style={{
                      position:        'absolute',
                      left:            p1.x - r,
                      top:             p1.y - r,
                      width:           r * 2,
                      height:          r * 2,
                      borderRadius:    r,
                      backgroundColor: Colors.surface,
                      borderWidth:     1.5,
                      borderColor:     color,
                    }}
                  />
                </React.Fragment>
              );
            })}

            <View
              style={{
                position:        'absolute',
                left:            last.x - 6,
                top:             last.y - 6,
                width:           12,
                height:          12,
                borderRadius:    6,
                backgroundColor: color,
                shadowColor:     color,
                shadowOffset:    { width: 0, height: 2 },
                shadowOpacity:   0.4,
                shadowRadius:    4,
                elevation:       3,
              }}
            />
            <Text style={[s.valLabel, { color, top: labelTop, left: labelLeft }]}>
              {fromKg(values[values.length - 1])}
            </Text>
          </>
        )}
      </View>

      <View style={s.xRow}>
        <Text style={s.xLabel}>{format(new Date(data[0].timestamp), 'MMM d')}</Text>
        <Text style={s.xLabel}>{data.length} sessions</Text>
        <Text style={s.xLabel}>{format(new Date(data[data.length - 1].timestamp), 'MMM d')}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.md,
    paddingBottom:     Spacing.sm,
    borderTopWidth:    1,
    borderTopColor:    Colors.border,
    backgroundColor:   Colors.surface,
  },
  header: {
    gap:          Spacing.xs,
    marginBottom: Spacing.sm,
  },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: {
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       Colors.border,
    backgroundColor:   Colors.surfaceAlt,
  },
  tabText: {
    fontSize:   FontSize.xs,
    fontWeight: '600',
    color:      Colors.textSecondary,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  prBadge: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      Radius.full,
    borderWidth:       1,
  },
  prText: { fontSize: FontSize.xs, fontWeight: '800', letterSpacing: 0.5 },
  deltaBadge: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      Radius.full,
  },
  deltaText: { fontSize: FontSize.xs, fontWeight: '700' },
  grid: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: Colors.border,
    opacity:         0.6,
  },
  valLabel: {
    position:   'absolute',
    fontSize:   FontSize.xs,
    fontWeight: '800',
  },
  xRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      Spacing.xs,
  },
  xLabel: { color: Colors.textMuted, fontSize: 10 },
});
