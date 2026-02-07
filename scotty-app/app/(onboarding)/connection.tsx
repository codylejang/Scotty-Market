import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Scotty from '@/components/Scotty';
import { seedNessieDemo, fetchTransactions, runFullSeed } from '@/services/api';
import { Colors, Shadows } from '@/constants/Theme';
import { useApp } from '@/context/AppContext';

const SCOTTY_NAME = 'Scotty';

export default function ConnectionScreen() {
  const router = useRouter();
  const { resetTutorial } = useApp();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isReseeding, setIsReseeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = () => {
    Alert.alert(
      'Connect Bank Account',
      'Plaid connection is coming soon. Use Demo Mode to continue instantly.'
    );
  };

  const handleDemoMode = async () => {
    if (isSeeding || isReseeding) return;
    setIsSeeding(true);
    setError(null);
    try {
      // Check if seed data already exists
      const existing = await fetchTransactions(30).catch(() => []);
      if (existing.length === 0) {
        // No seed found — create one
        await seedNessieDemo();
      }
      resetTutorial();
      router.replace('/(tabs)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Demo seed failed.';
      setError(message);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleReseed = async () => {
    if (isSeeding || isReseeding) return;
    setIsReseeding(true);
    setError(null);
    try {
      await runFullSeed();
      resetTutorial();
      router.replace('/(tabs)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reseed failed.';
      setError(message);
    } finally {
      setIsReseeding(false);
    }
  };

  return (
    <LinearGradient
      colors={[Colors.stickyBlue, Colors.paper]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.headerBlock}>
            <Text style={styles.kicker}>Connection</Text>
            <Text style={styles.title}>To feed {SCOTTY_NAME}, we need your transactions.</Text>
            <Text style={styles.subTitle}>Don’t worry — we only sniff, never bite.</Text>
          </View>

          <View style={styles.centerStage}>
            <View style={styles.scottyRow}>
              <Scotty size={120} />
              <View style={styles.leashTag}>
                <Text style={styles.leashText}>Ready when you are.</Text>
              </View>
            </View>
            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>Hackathon Tip</Text>
              <Text style={styles.tipText}>
                Demo Mode preloads fake data so judges don’t need real bank logins.
              </Text>
            </View>
          </View>

          <View style={styles.actionsCard}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity style={styles.primaryButton} onPress={handleConnect} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Connect Bank Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, (isSeeding || isReseeding) && styles.buttonDisabled]}
              onPress={handleDemoMode}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonText}>
                {isSeeding ? 'Loading Demo...' : 'Demo Mode (Instant)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reseedButton, (isSeeding || isReseeding) && styles.buttonDisabled]}
              onPress={handleReseed}
              activeOpacity={0.85}
            >
              <Text style={styles.reseedButtonText}>
                {isReseeding ? 'Reseeding...' : 'Reseed Demo Data'}
              </Text>
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
    fontSize: 24,
    lineHeight: 30,
    color: Colors.ink,
  },
  subTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  centerStage: {
    alignItems: 'center',
    gap: 16,
  },
  scottyRow: {
    alignItems: 'center',
    gap: 10,
  },
  leashTag: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...Shadows.sketchSm,
  },
  leashText: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    color: Colors.ink,
  },
  tipCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 16,
    padding: 12,
    maxWidth: '90%',
    ...Shadows.sketchSm,
  },
  tipTitle: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: Colors.textSecondary,
  },
  tipText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  actionsCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    ...Shadows.sketch,
  },
  errorText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: Colors.error,
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
  secondaryButton: {
    backgroundColor: Colors.stickyGreen,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'SpaceMono',
    fontSize: 14,
    color: Colors.ink,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  reseedButton: {
    borderWidth: 2,
    borderColor: Colors.textMuted,
    borderRadius: 14,
    borderStyle: 'dashed',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  reseedButtonText: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    color: Colors.textMuted,
  },
});
