import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface AnimatedProgressBarProps {
  /** Target width as a number 0-100 (percent) */
  targetPercent: number;
  /** Bar fill color */
  color: string;
  /** Delay before animation starts (ms) */
  delay?: number;
  /** Height of the bar container */
  height?: number;
  /** Whether this is a "small" bar (no border) */
  small?: boolean;
  /** Change to retrigger the animation */
  animationKey?: string | number;
}

export default function AnimatedProgressBar({
  targetPercent,
  color,
  delay = 0,
  height = 20,
  small = false,
  animationKey,
}: AnimatedProgressBarProps) {
  const widthPercent = useSharedValue(0);

  useEffect(() => {
    widthPercent.value = 0;
    widthPercent.value = withDelay(
      delay,
      withTiming(targetPercent, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [targetPercent, delay, animationKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${widthPercent.value}%`,
  }));

  return (
    <View style={[small ? styles.containerSmall : styles.container, { height }]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color },
          small && styles.fillSmall,
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffece6',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 20,
    overflow: 'hidden',
  },
  containerSmall: {
    backgroundColor: '#ffece6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  fillSmall: {
    borderRadius: 3,
  },
});
