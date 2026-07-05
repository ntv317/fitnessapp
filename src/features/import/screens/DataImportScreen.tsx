import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, Radius } from '@/core/theme';
import { ImportService } from '../services/ImportService';
import { useRepository } from '@/features/workout/hooks/useRepository';
import { useQueryClient } from '@tanstack/react-query';
import { EXERCISES_KEY } from '@/features/workout/hooks/useExercises';

const AI_PROMPT = `Create a weekly workout plan for me and output it as JSON only — no explanation, no markdown, no code fences.

Format:
[
  {
    "day": "PUSH",
    "exercises": [
      { "name": "Bench Press", "isCompound": true, "sets": 3, "repMin": 8, "repMax": 12, "muscleGroup": "Chest" }
    ]
  }
]

Rules:
- Output an array of workout days (e.g. 3–5 days depending on my goal)
- sets: the number of working sets for the exercise (e.g. 3)
- repMin/repMax: the target rep range for each set (e.g. 8 and 12)
- muscleGroup: exactly one of Abs, Back, Biceps, Calf, Chest, Forearms, Legs, Shoulders, Triceps
- isCompound: true for multi-joint moves (bench, squat, row, press, deadlift, pull-up); false for single-joint (curl, lateral raise, pushdown, fly)
- Day names should be descriptive: PUSH, PULL, LEGS, SHOULDERS, BACK + ARMS, FULL BODY, etc.

Exercise names — this matters for matching to the built-in exercise library:
- Write the FULL standard name and lead with the equipment: "Barbell Bench Press", "Dumbbell Incline Press", "Cable Rope Triceps Pushdown", "Barbell Romanian Deadlift", "Machine Leg Press".
- Do NOT abbreviate. Write "Dumbbell" not "DB", "Barbell" not "BB", "Overhead Press" not "OHP", "Romanian Deadlift" not "RDL".
- Prefer well-known names from standard exercise databases over gym slang.

My goal: [REPLACE — e.g. "build muscle, 4 days/week, intermediate"]`;

export default function DataImportScreen() {
  const router = useRouter();
  const repo = useRepository();
  const qc = useQueryClient();
  const service = React.useMemo(() => new ImportService(repo), [repo]);

  const [json, setJson] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const copyPrompt = useCallback(async () => {
    try {
      await Share.share({ message: AI_PROMPT });
    } catch {
      // user dismissed share sheet — not an error
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, []);

  const handleImport = useCallback(async () => {
    if (!json.trim()) return;
    setStatus('loading');
    const result = await service.importJSON(json);
    if (result.ok) {
      setStatus('ok');
      setMessage(`✓ Plan imported & set active — ${result.days} days · ${result.exercises} exercises`);
      setJson('');
      qc.invalidateQueries({ queryKey: EXERCISES_KEY });
      // The import lands as a new active plan — the Plans tab must refetch too.
      qc.invalidateQueries({ queryKey: ['plans'] });
    } else {
      setStatus('error');
      setMessage(result.error);
    }
  }, [json, service, qc]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <Text style={styles.title}>Plan with AI</Text>

        <Text style={styles.sub}>
          Imports a weekly plan and sets it active. Re-importing is safe — each import lands as its own plan, and your logged history is never touched.
        </Text>

        {/* Step 1 */}
        <View style={styles.step}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
            <Text style={styles.stepTitle}>Copy the prompt</Text>
          </View>
          <Text style={styles.stepDesc}>
            Paste into ChatGPT or Claude and replace the goal at the bottom.
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText} numberOfLines={8}>{AI_PROMPT}</Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={copyPrompt}>
            <Ionicons
              name={copied ? 'checkmark' : 'share-outline'}
              size={16}
              color={Colors.white}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.primaryBtnText}>
              {copied ? 'Shared!' : 'Share Prompt'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Step 2 */}
        <View style={styles.step}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
            <Text style={styles.stepTitle}>Paste the JSON response</Text>
          </View>
          <Text style={styles.stepDesc}>
            The AI will return all workout days at once — paste the full JSON below.
          </Text>

          {status === 'ok' && (
            <View style={styles.bannerOk}>
              <Text style={styles.bannerOkText}>{message}</Text>
            </View>
          )}
          {status === 'error' && (
            <View style={styles.bannerErr}>
              <Text style={styles.bannerErrText}>⚠  {message}</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            multiline
            placeholder={'[\n  { "day": "PUSH", "exercises": [...] },\n  { "day": "PULL", "exercises": [...] }\n]'}
            placeholderTextColor={Colors.textMuted}
            value={json}
            onChangeText={(v) => { setJson(v); setStatus('idle'); }}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.importBtn, (!json.trim() || status === 'loading') && styles.importBtnDisabled]}
          onPress={handleImport}
          disabled={!json.trim() || status === 'loading'}
        >
          {status === 'loading' ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.importBtnText}>Import Weekly Plan</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: 60 },
  title: { color: Colors.textPrimary, fontSize: FontSize.xxl, fontWeight: '900', marginBottom: Spacing.sm },
  backBtn: { marginBottom: Spacing.sm, alignSelf: 'flex-start' },
  sub: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.lg },

  step: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  stepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '800' },
  stepTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  stepDesc: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 18, marginBottom: Spacing.sm },

  codeBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  codeText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: Spacing.sm, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', minHeight: 44 },
  primaryBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },

  bannerOk: { backgroundColor: '#f0fdf4', borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderColor: '#bbf7d0' },
  bannerOkText: { color: '#15803d', fontSize: FontSize.sm, fontWeight: '600' },
  bannerErr: { backgroundColor: '#fff7ed', borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderColor: '#fed7aa' },
  bannerErrText: { color: '#c2410c', fontSize: FontSize.sm, fontWeight: '600' },

  input: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 160,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  importBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 2, alignItems: 'center', marginTop: Spacing.sm, minHeight: 50, justifyContent: 'center' },
  importBtnDisabled: { opacity: 0.4 },
  importBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },

});
