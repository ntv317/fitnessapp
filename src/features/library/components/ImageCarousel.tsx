import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/core/theme';
import { AppText } from '@/core/ui';
import { imageUrl } from '../services/ExerciseCatalog';

interface ImageCarouselProps {
  images: string[];
  instructions?: string[];
}

/** Paged image carousel with dot indicators and an optional instructions modal. */
export function ImageCarousel({ images, instructions }: ImageCarouselProps) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  if (images.length === 0) return null;

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {images.map((img) => (
          <Image
            key={img}
            source={{ uri: imageUrl(img) }}
            style={{ width, height: width * 0.85 }}
            contentFit="contain"
            cachePolicy="disk"
          />
        ))}
      </ScrollView>

      <View style={styles.controlRow}>
        {instructions && instructions.length > 0 ? (
          <TouchableOpacity onPress={() => setShowInfo(true)} hitSlop={10}>
            <Ionicons name="information-circle-outline" size={28} color={Colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}

        <View style={styles.dots}>
          {images.map((img, i) => (
            <View key={img} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>

        <View style={{ width: 28 }} />
      </View>

      <Modal visible={showInfo} animationType="slide" transparent onRequestClose={() => setShowInfo(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <AppText variant="headlineMd">Instructions</AppText>
              <TouchableOpacity onPress={() => setShowInfo(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {(instructions ?? []).map((step, i) => (
                <AppText key={i} variant="bodyMd" color={Colors.textSecondary} style={styles.step}>
                  {i + 1}. {step}
                </AppText>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  step: { marginBottom: Spacing.sm },
});
