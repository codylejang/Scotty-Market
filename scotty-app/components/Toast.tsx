import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
}

const FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';

export default function Toast({ message, visible, onDismiss }: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      translateY.value = withTiming(-80, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
      return;
    }

    translateY.value = withTiming(0, { duration: 220 });
    opacity.value = withTiming(1, { duration: 220 });

    const hideTimer = setTimeout(() => {
      translateY.value = withTiming(-80, { duration: 220 });
      opacity.value = withTiming(0, { duration: 220 });
      setTimeout(onDismiss, 250);
    }, 3000);

    return () => clearTimeout(hideTimer);
  }, [visible, message, onDismiss, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible || !message) return null;

  return (
    <Animated.View style={[styles.container, { top: insets.top + 8 }, animatedStyle]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
    backgroundColor: '#fff9c4',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  text: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },
});
