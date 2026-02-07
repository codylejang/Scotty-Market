import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors } from '@/constants/Theme';

interface PawLoaderProps {
  size?: number;
  color?: string;
}

const PAW_COUNT = 4;
const STAGGER_DELAY = 300;
const ANIMATION_DURATION = 600;

/**
 * Cute paw-print walking loader.
 * Shows a series of paw prints that appear one after another,
 * like a little dog walking across the screen.
 */
export default function PawLoader({ size = 16, color = Colors.violet }: PawLoaderProps) {
  const anims = useRef(
    Array.from({ length: PAW_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * STAGGER_DELAY),
          Animated.timing(anim, {
            toValue: 1,
            duration: ANIMATION_DURATION,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: ANIMATION_DURATION,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay((PAW_COUNT - 1 - i) * STAGGER_DELAY),
        ])
      )
    );

    Animated.parallel(animations).start();

    return () => {
      animations.forEach((a) => a.stop());
    };
  }, []);

  return (
    <View style={styles.container}>
      {anims.map((anim, i) => {
        const isLeft = i % 2 === 0;
        const opacity = anim;
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [4, -2],
        });
        const scale = anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.6, 1.1, 1],
        });
        const rotate = isLeft ? '-15deg' : '15deg';

        return (
          <Animated.View
            key={i}
            style={[
              styles.pawWrap,
              {
                opacity,
                transform: [{ translateY }, { scale }, { rotate }],
                marginTop: isLeft ? 4 : 0,
              },
            ]}
          >
            <PawPrint size={size} color={color} />
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Simple paw print drawn with Views (no SVG needed) */
function PawPrint({ size, color }: { size: number; color: string }) {
  const pad = size * 0.38;
  const toe = size * 0.22;
  const gap = size * 0.06;

  return (
    <View style={{ width: size, height: size * 1.1, alignItems: 'center' }}>
      {/* Toes row */}
      <View style={{ flexDirection: 'row', gap: gap, marginBottom: gap }}>
        <View
          style={[
            styles.toe,
            {
              width: toe,
              height: toe * 1.2,
              borderRadius: toe / 2,
              backgroundColor: color,
              transform: [{ rotate: '-20deg' }],
            },
          ]}
        />
        <View
          style={[
            styles.toe,
            {
              width: toe,
              height: toe * 1.2,
              borderRadius: toe / 2,
              backgroundColor: color,
              transform: [{ translateY: -gap }],
            },
          ]}
        />
        <View
          style={[
            styles.toe,
            {
              width: toe,
              height: toe * 1.2,
              borderRadius: toe / 2,
              backgroundColor: color,
              transform: [{ rotate: '20deg' }],
            },
          ]}
        />
      </View>
      {/* Main pad */}
      <View
        style={{
          width: pad,
          height: pad * 0.85,
          borderRadius: pad * 0.4,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  pawWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toe: {},
});
