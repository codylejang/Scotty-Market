import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { DailyInsight } from '../types';

interface InsightBubbleProps {
  insight: DailyInsight;
}

const TYPE_STYLES = {
  positive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    textColor: '#166534',
  },
  neutral: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    textColor: '#374151',
  },
  warning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    textColor: '#92400E',
  },
};

export function InsightBubble({ insight }: InsightBubbleProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const typeStyle = TYPE_STYLES[insight.type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: typeStyle.backgroundColor,
          borderColor: typeStyle.borderColor,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Speech bubble pointer */}
      <View
        style={[
          styles.pointer,
          { borderTopColor: typeStyle.backgroundColor },
        ]}
      />
      <View
        style={[
          styles.pointerBorder,
          { borderTopColor: typeStyle.borderColor },
        ]}
      />

      <Text style={[styles.message, { color: typeStyle.textColor }]}>
        {insight.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    marginHorizontal: 20,
    marginTop: 8,
    position: 'relative',
  },
  pointer: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  pointerBorder: {
    position: 'absolute',
    bottom: -14,
    left: '50%',
    marginLeft: -12,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default InsightBubble;
