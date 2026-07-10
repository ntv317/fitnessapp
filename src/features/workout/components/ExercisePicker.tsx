import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSize, Radius } from '@/core/theme';
import type { Exercise } from '@/core/database/types';
import { useExerciseDisplayName } from '@/features/library/hooks/useExerciseDisplayName';

interface Props {
  exercises: Exercise[];
  selected: Exercise | null;
  onSelect: (exercise: Exercise) => void;
}

export function ExercisePicker({ exercises, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const exerciseDisplayName = useExerciseDisplayName();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = exercises.filter(
    (e) =>
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      exerciseDisplayName(e).toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.triggerText : styles.placeholder}>
          {selected ? exerciseDisplayName(selected) : t('workout.selectExercise')}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('workout.chooseExercise')}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.close}>{t('workout.done')}</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.search}
            placeholder={t('workout.search')}
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                onPress={() => {
                  onSelect(item);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <Text style={styles.itemName}>{exerciseDisplayName(item)}</Text>
                {item.isCompound && <Text style={styles.badge}>{t('workout.compound')}</Text>}
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  triggerText: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },
  placeholder: { color: Colors.textMuted, fontSize: FontSize.md },
  chevron: { color: Colors.textSecondary, fontSize: FontSize.xl },
  sheet: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
  close: { color: Colors.primary, fontSize: FontSize.md },
  search: {
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  itemPressed: { backgroundColor: Colors.surfaceAlt },
  itemName: { color: Colors.textPrimary, fontSize: FontSize.md },
  badge: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.lg },
});
