import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import { format } from 'date-fns';
// Deep import: the package index pulls in BarChart, whose gradient helper
// throws at load unless react-native-linear-gradient / expo-linear-gradient is
// installed. LineChart itself only needs react-native-svg.
import { LineChart } from 'react-native-gifted-charts/dist/LineChart';
import { Colors, Spacing, FontSize, Radius } from '@/core/theme';
import { useUnit } from '@/core/context/UnitContext';
import type { WorkoutLog } from '@/core/database/types';

type Metric = 'maxWeight' | 'oneRM' | 'volume' | 'bestReps';

interface Props {
  logs: WorkoutLog[];
  color?: string;
  /** Which tabs to show, in order. Defaults to the original Max/Est. 1RM/Volume set. */
  metrics?: { key: Metric; label: string }[];
}

const CHART_H  = 160;
const MAX_SESS = 20;
const Y_AXIS_W = 36;

const BASE_METRICS: { key: Metric; label: string }[] = [
  { key: 'maxWeight', label: 'Max'      },
  { key: 'oneRM',     label: 'Est. 1RM' },
  { key: 'volume',    label: 'Volume'   },
];

function epley(w: number, r: number) {
  return r <= 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10;
}

export function ProgressChart({ logs, color = Colors.primary, metrics: metricsProp }: Props) {
  const metricOptions = metricsProp ?? BASE_METRICS;
  const [metric, setMetric] = useState<Metric>(metricOptions[0].key);
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
        bestReps:  Math.max(...valid.map((s) => s.reps)),
        timestamp: log.timestamp,
      };
    }).filter(Boolean) as {
      session: number; maxWeight: number; oneRM: number;
      volume: number; bestReps: number; timestamp: number;
    }[];
  }, [logs]);

  if (data.length < 2) return null;

  const metrics = metricOptions.map((m) =>
    m.key === 'maxWeight' && !metricsProp ? { ...m, label: `Max ${weightUnit}` } : m,
  );

  const onLayout = (e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width);

  // bestReps is a rep count, not a weight — kg/lbs conversion doesn't apply to it.
  const convert = metric === 'bestReps' ? (v: number) => v : fromKg;
  const values  = data.map((d) => convert(d[metric]));
  const isPR    = values[values.length - 1] >= Math.max(...values.slice(0, -1));

  const yMin    = Math.min(...values);
  const yMax    = Math.max(...values);
  const yRange  = yMax - yMin || yMax * 0.1 || 1;
  const yPad    = yRange * 0.25;
  const yOffset = Math.max(0, Math.floor(yMin - yPad));
  const yTop    = Math.ceil(yMax + yPad);

  const dispFirst = values[0];
  const dispLast  = values[values.length - 1];
  const delta     = dispLast - dispFirst;
  const sign      = delta >= 0 ? '+' : '';
  const pct       = dispFirst > 0 ? `${sign}${((delta / dispFirst) * 100).toFixed(0)}%` : '';
  const deltaAmt  = `${sign}${Math.abs(delta) < 1 ? delta.toFixed(1) : Math.round(delta)}`;
  const unit      = metric === 'volume' ? `${weightUnit} vol` : metric === 'bestReps' ? 'reps' : weightUnit;
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

      <View onLayout={onLayout}>
        {chartW > 0 && (
          <LineChart
            key={`${metric}-${chartW}`}
            data={values.map((value) => ({ value }))}
            width={chartW - Y_AXIS_W}
            height={CHART_H}
            adjustToWidth
            disableScroll
            curved
            areaChart
            thickness={3}
            color={color}
            startFillColor={color}
            endFillColor={color}
            startOpacity={0.22}
            endOpacity={0.02}
            yAxisOffset={yOffset}
            maxValue={yTop - yOffset}
            noOfSections={4}
            initialSpacing={10}
            endSpacing={10}
            rulesType="dashed"
            rulesColor={Colors.border}
            dashWidth={4}
            dashGap={5}
            yAxisColor="transparent"
            xAxisColor={Colors.border}
            yAxisLabelWidth={Y_AXIS_W}
            yAxisTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
            formatYLabel={(l: string) => {
              const n = Number(l);
              return Number.isInteger(n) ? String(n) : n.toFixed(1);
            }}
            customDataPoint={() => <View style={[s.dot, { backgroundColor: color }]} />}
          />
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
  dot: {
    width:        12,
    height:       12,
    borderRadius: 6,
    borderWidth:  2.5,
    borderColor:  Colors.surface,
  },
  xRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      Spacing.xs,
  },
  xLabel: { color: Colors.textMuted, fontSize: 10 },
});
