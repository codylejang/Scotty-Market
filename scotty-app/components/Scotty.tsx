import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { MoodState } from '../types';

interface ScottyProps {
  mood: MoodState;
  size?: 'small' | 'medium' | 'large';
}

const SIZES = {
  small: 60,
  medium: 120,
  large: 180,
};

// Pixel art SVG of Scotty based on the reference design
function ScottySvg({ mood, size }: { mood: MoodState; size: number }) {
  const showTongue = mood === 'happy';
  const earDroop = mood === 'sad' || mood === 'worried';

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ imageRendering: 'pixelated' } as any}
    >
      {/* Main body/head shape - brown fur */}
      <Path
        d="M7 6 h10 v1 h2 v1 h1 v2 h1 v5 h-1 v2 h-1 v1 h-1 v1 h-1 v1 h-2 v-1 h-1 v1 h-2 v-1 h-2 v-1 h-1 v-1 h-1 v-1 h-1 v-2 h-1 v-5 h1 v-2 h1 v-1 h2 z"
        fill="#4a3728"
      />

      {/* Ears */}
      <Path
        d={earDroop
          ? "M5 6 h2 v2 h-1 v1 h-1 z M17 6 h2 v1 h-1 v2 h-1 z"
          : "M6 5 h2 v3 h-2 z M16 5 h2 v3 h-2 z"
        }
        fill="#4a3728"
      />

      {/* White face/snout area */}
      <Path
        d="M10 10 h4 v3 h2 v2 h-1 v1 h-6 v-1 h-1 v-2 h2 z"
        fill="white"
      />

      {/* Eye whites */}
      <Rect fill="white" height={1} width={1} x={9} y={9} />
      <Rect fill="white" height={1} width={1} x={14} y={9} />

      {/* Pupils */}
      <Rect fill="#1a1a1a" height={1} width={1} x={10} y={10} />
      <Rect fill="#1a1a1a" height={1} width={1} x={14} y={10} />

      {/* Nose */}
      <Path d="M11 12h2v1h-2z" fill="#1a1a1a" />

      {/* Tongue (only when happy) */}
      {showTongue && (
        <Path d="M11 14h2v2h-2z" fill="#ffab91" />
      )}

      {/* Mouth/smile area */}
      <Path d="M8 17h8v1h-8z" fill="#ffab91" />
    </Svg>
  );
}

export function Scotty({ mood, size = 'medium' }: ScottyProps) {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  const dimension = SIZES[size];

  useEffect(() => {
    // Bounce animation based on mood
    const bounceHeight = mood === 'happy' ? -8 : mood === 'content' ? -4 : -2;
    const duration = mood === 'happy' ? 400 : mood === 'content' ? 700 : 1000;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: bounceHeight,
          duration: duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [mood, bounceAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          transform: [
            { translateY: bounceAnim },
            { scale: size === 'large' ? 5 : size === 'medium' ? 3 : 1.5 },
          ],
          opacity: mood === 'sad' ? 0.7 : 1,
        },
      ]}
    >
      <ScottySvg mood={mood} size={24} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Scotty;
