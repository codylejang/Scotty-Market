import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MoodState } from '../types';

interface HappinessBarProps {
  happiness: number; // 0-100
  mood: MoodState;
  showLabel?: boolean;
}

const MOOD_COLORS: Record<MoodState, string> = {
  happy: '#22C55E',    // Green
  content: '#84CC16',  // Lime
  worried: '#F59E0B',  // Amber
  sad: '#EF4444',      // Red
};

const MOOD_EMOJIS: Record<MoodState, string> = {
  happy: '🐕',
  content: '🐶',
  worried: '😟',
  sad: '😢',
};

export function HappinessBar({ happiness, mood, showLabel = true }: HappinessBarProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animate width change
    Animated.timing(widthAnim, {
      toValue: happiness,
      duration: 500,
      useNativeDriver: false,
    }).start();

    // Pulse animation when happiness changes
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [happiness, widthAnim, pulseAnim]);

  const color = MOOD_COLORS[mood];
  const emoji = MOOD_EMOJIS[mood];

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>Happiness</Text>
          <Text style={styles.value}>
            {emoji} {happiness}%
          </Text>
        </View>
      )}
      <View style={styles.barBackground}>
        <Animated.View
          style={[
            styles.barFill,
            {
              width: animatedWidth,
              backgroundColor: color,
            },
          ]}
        />
        {/* Segment markers */}
        <View style={[styles.marker, { left: '25%' }]} />
        <View style={[styles.marker, { left: '50%' }]} />
        <View style={[styles.marker, { left: '75%' }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  barBackground: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});

export default HappinessBar;
