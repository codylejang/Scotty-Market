import React from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

interface DraggableFoodItemProps {
  emoji: string;
  count: number;
  bgColor: string;
  /** Scotty's position in absolute coords { x, y, width, height } */
  scottyLayout: { x: number; y: number; width: number; height: number } | null;
  /** Called when item is dropped on Scotty */
  onFeed: () => void;
}

const DROP_THRESHOLD = 80;

export default function DraggableFoodItem({
  emoji,
  count,
  bgColor,
  scottyLayout,
  onFeed,
}: DraggableFoodItemProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const disabled = count <= 0;

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      scale.value = withSpring(1.15, { damping: 10 });
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      // Check if dropped near Scotty
      if (scottyLayout) {
        const scottyCenterX = scottyLayout.x + scottyLayout.width / 2;
        const scottyCenterY = scottyLayout.y + scottyLayout.height / 2;
        // e.absoluteX/Y gives the finger's screen position
        const dx = e.absoluteX - scottyCenterX;
        const dy = e.absoluteY - scottyCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < DROP_THRESHOLD) {
          runOnJS(onFeed)();
        }
      }

      // Spring back
      translateX.value = withSpring(0, { damping: 15 });
      translateY.value = withSpring(0, { damping: 15 });
      scale.value = withSpring(1, { damping: 15 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.iconCard,
          { backgroundColor: bgColor },
          disabled && styles.iconCardDisabled,
          animatedStyle,
        ]}
      >
        <Text style={styles.iconEmoji}>{emoji}</Text>
        <View style={[styles.badge, disabled && styles.badgeDisabled]}>
          <Text style={styles.badgeText}>{count}x</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  iconCard: {
    width: 56,
    height: 56,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  iconCardDisabled: {
    opacity: 0.4,
  },
  iconEmoji: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ff6b6b',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeDisabled: {
    backgroundColor: '#999',
  },
  badgeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 8,
    fontWeight: '900',
    color: '#fff',
  },
});
