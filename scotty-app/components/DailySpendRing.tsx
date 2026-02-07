import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DailySpendRingProps {
  spent: number;
  limit: number;
  size?: number;
}

export default function DailySpendRing({ spent, limit, size = 80 }: DailySpendRingProps) {
  const percent = limit > 0 ? spent / limit : 0;
  const clampedPercent = Math.min(percent, 1); // clamp fill to 100% max
  const displayPercent = Math.round(percent * 100);

  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      300,
      withTiming(clampedPercent, { duration: 800, easing: Easing.out(Easing.cubic) })
    );
  }, [clampedPercent]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  // Color based on budget status
  const isOver = percent > 1;
  const isNear = percent >= 0.85 && percent <= 1;
  const ringColor = isOver ? '#ff6b6b' : isNear ? '#ffb347' : '#4caf50';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#e0e0e0"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Foreground animated arc */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        <Text style={[styles.percentText, isOver && styles.percentTextOver]}>
          {displayPercent}%
        </Text>
        {isOver && <Text style={styles.overText}>OVER</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
  },
  percentTextOver: {
    color: '#ff6b6b',
  },
  overText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 8,
    fontWeight: '900',
    color: '#ff6b6b',
    letterSpacing: 1,
  },
});
