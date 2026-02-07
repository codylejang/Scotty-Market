import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Scotty from '@/components/Scotty';
import { useApp } from '@/context/AppContext';
import { Colors, Shadows } from '@/constants/Theme';

const SCOTTY_NAME = 'Scotty';

export default function AgreementScreen() {
  const router = useRouter();
  const { onboarding, setOnboardingAgreed } = useApp();
  const confirmed = onboarding.agreedToPact;

  return (
    <LinearGradient
      colors={[Colors.paperDark, Colors.stickyPink]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.headerBlock}>
            <Text style={styles.kicker}>The Rules</Text>
            <Text style={styles.title}>{SCOTTY_NAME} lives on your transaction data.</Text>
          </View>

          <View style={styles.scottyStage}>
            <Scotty size={150} />
            <View style={styles.speechBubble}>
              <Text style={styles.speechText}>
                Good habits (saving, budgeting) = treats and growth. Bad habits
                (overspending, fees) = a sick pup.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>The pact</Text>
            <Text style={styles.cardText}>
              You are in charge of {SCOTTY_NAME}'s health. Keep his wallet clean,
              and he stays happy and strong.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, confirmed && styles.primaryButtonConfirmed]}
              onPress={() => {
                if (!confirmed) setOnboardingAgreed(true);
                setTimeout(() => {
                  router.push('/(onboarding)/connection');
                }, 120);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>I promise to take care of him</Text>
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
    fontSize: 26,
    lineHeight: 32,
    color: Colors.ink,
  },
  scottyStage: {
    alignItems: 'center',
    gap: 12,
  },
  speechBubble: {
    maxWidth: '85%',
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 16,
    padding: 12,
    ...Shadows.sketchSm,
  },
  speechText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    lineHeight: 18,
    color: Colors.ink,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    ...Shadows.sketch,
  },
  cardTitle: {
    fontFamily: 'SpaceMono',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: Colors.textSecondary,
  },
  cardText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    lineHeight: 20,
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
  primaryButtonConfirmed: {
    backgroundColor: Colors.success,
  },
  primaryButtonText: {
    fontFamily: 'SpaceMono',
    fontSize: 15,
    color: Colors.ink,
  },
});
