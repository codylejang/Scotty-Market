import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

interface HeartBurstProps {
  /** Center X position */
  x: number;
  /** Center Y position */
  y: number;
  /** Called when animation completes */
  onFinish: () => void;
}

const HEART_COUNT = 6;
const DURATION = 600;

function Heart({
  angle,
  delay,
  x,
  y,
  onFinish,
  isLast,
}: {
  angle: number;
  delay: number;
  x: number;
  y: number;
  onFinish: () => void;
  isLast: boolean;
}) {
  const scale = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const dist = 40 + Math.random() * 30;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;

    scale.value = withDelay(
      delay,
      withTiming(1.2, { duration: DURATION * 0.4, easing: Easing.out(Easing.back(2)) })
    );
    translateX.value = withDelay(
      delay,
      withTiming(tx, { duration: DURATION, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      delay,
      withTiming(ty, { duration: DURATION, easing: Easing.out(Easing.cubic) })
    );
    opacity.value = withDelay(
      delay + DURATION * 0.5,
      withTiming(0, { duration: DURATION * 0.5 }, (finished) => {
        if (finished && isLast) {
          runOnJS(onFinish)();
        }
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x - 8,
    top: y - 8,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return <Animated.Text style={[styles.heart, animatedStyle]}>❤️</Animated.Text>;
}

export default function HeartBurst({ x, y, onFinish }: HeartBurstProps) {
  const hearts = Array.from({ length: HEART_COUNT }, (_, i) => {
    const angle = (Math.PI * 2 * i) / HEART_COUNT + (Math.random() - 0.5) * 0.5;
    const delay = i * 40;
    return (
      <Heart
        key={i}
        angle={angle}
        delay={delay}
        x={x}
        y={y}
        onFinish={onFinish}
        isLast={i === HEART_COUNT - 1}
      />
    );
  });

  return <>{hearts}</>;
}

const styles = StyleSheet.create({
  heart: {
    fontSize: 16,
  },
});
