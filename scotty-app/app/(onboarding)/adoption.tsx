import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Scotty from '@/components/Scotty';
import { Colors, Shadows } from '@/constants/Theme';

const DEFAULT_NAME = 'Scotty';

export default function AdoptionScreen() {
  const router = useRouter();
  const [showWoof, setShowWoof] = useState(false);
  const [isAdopting, setIsAdopting] = useState(false);
  const jump = useRef(new Animated.Value(10)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  const handleAdopt = () => {
    if (isAdopting) return;
    setIsAdopting(true);
    setShowWoof(true);
    Vibration.vibrate(40);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(jump, {
          toValue: -22,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(jump, {
          toValue: -8,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(jump, {
          toValue: 4,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.05,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShowWoof(false);
      setIsAdopting(false);
      router.push('/(onboarding)/agreement');
    });
  };

  return (
    <LinearGradient
      colors={[Colors.paper, Colors.stickyYellow]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.headerBlock}>
            <Text style={styles.kicker}>Adoption Center</Text>
            <Text style={styles.title}>This puppy's health depends on your wallet.</Text>
          </View>

          <View style={styles.boxStage}>
              <Animated.View
                style={[
                  styles.scottyBehind,
                  {
                    transform: [{ translateY: jump }, { scale }],
                  },
                ]}
              >
                <Scotty size={130} />
              </Animated.View>
              {showWoof && (
                <View style={styles.woofBubble}>
                  <Text style={styles.woofText}>Woof!</Text>
                </View>
              )}
              <View style={styles.boxTop} />
              <View style={styles.boxFront}>
                <Text style={styles.boxLabel}>Scotty</Text>
              </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>Meet your new companion: {DEFAULT_NAME}</Text>
            <TouchableOpacity
              style={[styles.primaryButton, isAdopting && styles.buttonDisabled]}
              onPress={handleAdopt}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Adopt {DEFAULT_NAME}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    marginTop: 12,
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
    fontSize: 28,
    lineHeight: 34,
    color: Colors.ink,
  },
  subTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  boxStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    position: 'relative',
  },
  boxTop: {
    zIndex: 3,
    width: 220,
    height: 18,
    backgroundColor: '#d9b58a',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderBottomWidth: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    ...Shadows.sketchSm,
  },
  boxFront: {
    zIndex: 2,
    width: 220,
    height: 170,
    backgroundColor: '#e2c39b',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    ...Shadows.sketch,
  },
  boxLabel: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: 'Caveat',
    fontSize: 28,
    color: Colors.ink,
    transform: [{ rotate: '-4deg' }],
  },
  scottyBehind: {
    zIndex: 1,
    position: 'absolute',
    bottom: 66,
    left: -30,
    alignItems: 'center',
    transform: [{ scale: 0.95 }],
  },
  woofBubble: {
    position: 'absolute',
    bottom: 210,
    left: 10,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '-6deg' }],
  },
  woofText: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    color: Colors.ink,
  },
  formCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    ...Shadows.sketch,
  },
  inputLabel: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: Colors.textSecondary,
  },
  primaryButton: {
    backgroundColor: Colors.coral,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    ...Shadows.sketch,
  },
  primaryButtonText: {
    fontFamily: 'SpaceMono',
    fontSize: 16,
    color: Colors.ink,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
