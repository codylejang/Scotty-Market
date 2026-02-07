import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Scotty from '@/components/Scotty';
import { Colors, Shadows } from '@/constants/Theme';

const SCOTTY_NAME = 'Scotty';

export default function FirstFeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ budget?: string }>();
  const budget = (params.budget || '350').toString();
  const [isFed, setIsFed] = useState(false);
  const happiness = useRef(new Animated.Value(20)).current;
  const confetti = useRef(new Animated.Value(0)).current;

  const handleFeed = () => {
    if (isFed) return;
    setIsFed(true);

    Animated.timing(happiness, {
      toValue: 82,
      duration: 600,
      useNativeDriver: false,
    }).start();

    Animated.sequence([
      Animated.timing(confetti, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(confetti, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const confettiStyle = {
    opacity: confetti,
    transform: [
      {
        translateY: confetti.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -30],
        }),
      },
    ],
  };

  const happinessWidth = happiness.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient
      colors={[Colors.stickyPurple, Colors.paper]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.headerBlock}>
            <Text style={styles.kicker}>First Feed</Text>
            <Text style={styles.title}>You have enough budget left for a treat.</Text>
          </View>

          <View style={styles.dashboardCard}>
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>Tap Feed to give {SCOTTY_NAME} a snack.</Text>
            </View>
            <View style={styles.scottyRow}>
              <Scotty size={140} />
              <View style={styles.statsCard}>
                <Text style={styles.statLabel}>Weekly Safe-to-Spend</Text>
                <Text style={styles.statValue}>${budget}</Text>
                <Text style={styles.statLabel}>Stamina</Text>
                <View style={styles.happinessBar}>
                  <Animated.View style={[styles.happinessFill, { width: happinessWidth }]} />
                </View>
                <Text style={styles.statHint}>{isFed ? 'Happy and full.' : 'Hungry...'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, isFed && styles.buttonDisabled]}
              onPress={handleFeed}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>{isFed ? 'Fed!' : 'Feed'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>Great job!</Text>
            <Text style={styles.footerText}>Come back tomorrow to keep him happy.</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.secondaryButtonText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View pointerEvents="none" style={[styles.confetti, confettiStyle]}>
          <Text style={styles.confettiText}>✨🎉🦴</Text>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  headerBlock: {
    marginTop: 8,
    gap: 10,
  },
  kicker: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: Colors.textMuted,
  },
  title: {
    fontFamily: 'SpaceMono',
    fontSize: 24,
    lineHeight: 30,
    color: Colors.ink,
  },
  dashboardCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 18,
    padding: 16,
    gap: 16,
    ...Shadows.sketch,
  },
  tooltip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.stickyYellow,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    transform: [{ rotate: '-2deg' }],
  },
  tooltipText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: Colors.ink,
  },
  scottyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statsCard: {
    flex: 1,
    backgroundColor: Colors.paperDark,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 14,
    padding: 10,
    gap: 6,
  },
  statLabel: {
    fontFamily: 'SpaceMono',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.textMuted,
  },
  statValue: {
    fontFamily: 'SpaceMono',
    fontSize: 18,
    color: Colors.ink,
  },
  happinessBar: {
    height: 10,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 6,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  happinessFill: {
    height: '100%',
    backgroundColor: Colors.coral,
  },
  statHint: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  primaryButton: {
    backgroundColor: Colors.coral,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: 'SpaceMono',
    fontSize: 15,
    color: Colors.ink,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  footerCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    ...Shadows.sketch,
  },
  footerTitle: {
    fontFamily: 'SpaceMono',
    fontSize: 16,
    color: Colors.ink,
  },
  footerText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  secondaryButton: {
    backgroundColor: Colors.stickyYellow,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'SpaceMono',
    fontSize: 14,
    color: Colors.ink,
  },
  confetti: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  confettiText: {
    fontSize: 28,
  },
});
