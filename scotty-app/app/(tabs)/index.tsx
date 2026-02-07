import React from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { useApp } from '@/context/AppContext';
import Scotty from '@/components/Scotty';
import HappinessBar from '@/components/HappinessBar';
import InsightBubble from '@/components/InsightBubble';
import { FoodSelector } from '@/components/FoodButton';
import { getTotalSpending } from '@/services/mockData';
import { Colors, Shadows } from '@/constants/Theme';

export default function HomeScreen() {
  const {
    profile,
    transactions,
    achievements,
    scottyState,
    dailyInsight,
    feedScotty,
  } = useApp();

  const todaySpending = getTotalSpending(transactions, 1);
  const subscriptions = transactions.filter((t) => t.isSubscription).slice(0, 4);

  // Calculate savings goal progress (mock)
  const savingsGoal = 2000;
  const currentSavings = 1250;
  const savingsProgress = (currentSavings / savingsGoal) * 100;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Scotty Section */}
      <View style={styles.scottySection}>
        {/* Speech Bubble */}
        {dailyInsight && (
          <View style={styles.speechBubble}>
            <Text style={styles.speechText}>
              {dailyInsight.message.length > 50
                ? dailyInsight.message.substring(0, 50) + '...'
                : dailyInsight.message}
            </Text>
            <View style={styles.speechPointer} />
          </View>
        )}

        {/* Scotty Character */}
        <View style={styles.scottyContainer}>
          <Scotty mood={scottyState.mood} size="large" />
        </View>

        {/* Food Items (Sticky notes) */}
        <View style={styles.foodItems}>
          <View style={[styles.foodSticky, styles.stickyYellow, { transform: [{ rotate: '-2deg' }] }]}>
            <View style={styles.foodBadge}>
              <Text style={styles.foodBadgeText}>4x</Text>
            </View>
            <Text style={styles.foodIcon}>☕</Text>
          </View>
          <View style={[styles.foodSticky, styles.stickyPink, { transform: [{ rotate: '3deg' }] }]}>
            <View style={styles.foodBadge}>
              <Text style={styles.foodBadgeText}>3x</Text>
            </View>
            <Text style={styles.foodIcon}>🍴</Text>
          </View>
          <View style={[styles.foodSticky, styles.stickyBlue, { transform: [{ rotate: '-3deg' }] }]}>
            <View style={styles.foodBadge}>
              <Text style={styles.foodBadgeText}>12x</Text>
            </View>
            <Text style={styles.foodIcon}>💧</Text>
          </View>
          <View style={[styles.foodSticky, styles.stickyGreen, { transform: [{ rotate: '2deg' }] }]}>
            <View style={styles.foodBadge}>
              <Text style={styles.foodBadgeText}>1x</Text>
            </View>
            <Text style={styles.foodIcon}>🥐</Text>
          </View>
        </View>
      </View>

      {/* Happiness Bar */}
      <View style={styles.happinessContainer}>
        <View style={styles.happinessHeader}>
          <Text style={styles.happinessLabel}>HAPPINESS</Text>
          <Text style={styles.happinessValue}>{scottyState.happiness}%</Text>
        </View>
        <View style={styles.happinessBarBg}>
          <LinearGradient
            colors={[Colors.coral, Colors.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.happinessBarFill, { width: `${scottyState.happiness}%` }]}
          />
        </View>
      </View>

      {/* Savings Goal Card */}
      <View style={styles.savingsCard}>
        <View style={styles.savingsHeader}>
          <Text style={styles.savingsTitle}>NEW MACBOOK FUND</Text>
          <Text style={styles.savingsAmount}>
            <Text style={styles.savingsAmountHighlight}>${currentSavings.toLocaleString()}</Text>
            {' / $'}{savingsGoal.toLocaleString()}
          </Text>
        </View>
        <View style={styles.savingsBarBg}>
          <View style={[styles.savingsBarFill, { width: `${savingsProgress}%` }]} />
          <View style={[styles.savingsMarker, { left: `${savingsProgress}%` }]}>
            <Text style={styles.savingsMarkerIcon}>📍</Text>
          </View>
        </View>
        <View style={styles.savingsFooter}>
          <Text style={styles.savingsMessage}>Keep it up, Scotty is proud!</Text>
          <Text style={styles.savingsPercent}>{savingsProgress.toFixed(1)}% Complete</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardLeft]}>
          <Text style={styles.statLabel}>DAILY SPEND</Text>
          <Text style={styles.statValue}>${todaySpending.toFixed(2)}</Text>
          <View style={styles.statBarBg}>
            <View style={[styles.statBarFill, styles.statBarCoral, { width: '66%' }]} />
          </View>
        </View>
        <View style={[styles.statCard, styles.statCardRight]}>
          <Text style={styles.statLabel}>BANK TOTAL</Text>
          <Text style={[styles.statValue, styles.statValueViolet]}>
            ${profile.currentBalance.toLocaleString()}
          </Text>
          <View style={styles.statTrend}>
            <Text style={styles.statTrendIcon}>📈</Text>
            <Text style={styles.statTrendText}>+$120 today</Text>
          </View>
        </View>
      </View>

      {/* Subscriptions */}
      <View style={styles.subsSection}>
        <View style={styles.subsHeader}>
          <Text style={styles.subsTitle}>Upcoming Subs</Text>
          <TouchableOpacity style={styles.manageBtn}>
            <Text style={styles.manageBtnText}>Manage All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subsScroll}
        >
          {subscriptions.map((sub, index) => (
            <View key={sub.id} style={styles.subCard}>
              <TouchableOpacity style={styles.subCancelBtn}>
                <Text style={styles.subCancelIcon}>✕</Text>
              </TouchableOpacity>
              <View style={styles.subContent}>
                <View style={[
                  styles.subLogo,
                  { backgroundColor: ['#e53935', '#43a047', '#1e88e5', '#000'][index % 4] }
                ]}>
                  <Text style={styles.subLogoText}>
                    {sub.merchant.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.subPrice}>${sub.amount.toFixed(2)}</Text>
              </View>
              <Text style={[
                styles.subDue,
                { transform: [{ rotate: `${(index % 3 - 1) * 2}deg` }] }
              ]}>
                Due Oct {12 + index * 3}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Food Selector */}
      <FoodSelector
        credits={scottyState.foodCredits}
        onFeed={feedScotty}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
  content: {
    paddingBottom: 100,
  },

  // Scotty Section
  scottySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    minHeight: 200,
  },
  speechBubble: {
    position: 'absolute',
    top: 0,
    left: 16,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 16,
    padding: 8,
    maxWidth: 120,
    ...Shadows.sketchSm,
    transform: [{ rotate: '-2deg' }],
    zIndex: 10,
  },
  speechText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.ink,
    lineHeight: 14,
  },
  speechPointer: {
    position: 'absolute',
    bottom: -8,
    right: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.ink,
  },
  scottyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  foodItems: {
    position: 'absolute',
    right: 8,
    gap: 8,
  },
  foodSticky: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sketchSm,
  },
  stickyYellow: { backgroundColor: Colors.stickyYellow },
  stickyPink: { backgroundColor: Colors.stickyPink },
  stickyBlue: { backgroundColor: Colors.stickyBlue },
  stickyGreen: { backgroundColor: Colors.stickyGreen },
  foodBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.coral,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  foodBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: Colors.white,
  },
  foodIcon: {
    fontSize: 20,
  },

  // Happiness Bar
  happinessContainer: {
    paddingHorizontal: 60,
    marginTop: 16,
  },
  happinessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  happinessLabel: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
  },
  happinessValue: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ink,
  },
  happinessBarBg: {
    height: 16,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 999,
    overflow: 'hidden',
    ...Shadows.sketchSm,
  },
  happinessBarFill: {
    height: '100%',
    borderRadius: 999,
  },

  // Savings Card
  savingsCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 24,
    ...Shadows.sketch,
  },
  savingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  savingsTitle: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 0.5,
  },
  savingsAmount: {
    fontSize: 14,
    color: Colors.coral,
  },
  savingsAmountHighlight: {
    fontWeight: '700',
  },
  savingsBarBg: {
    height: 24,
    backgroundColor: Colors.paperDark,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 999,
    overflow: 'visible',
    position: 'relative',
  },
  savingsBarFill: {
    height: '100%',
    backgroundColor: Colors.accentBlue,
    borderRadius: 999,
  },
  savingsMarker: {
    position: 'absolute',
    top: -4,
    marginLeft: -8,
  },
  savingsMarkerIcon: {
    fontSize: 16,
  },
  savingsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  savingsMessage: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.textSecondary,
  },
  savingsPercent: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: Colors.violet,
    fontWeight: '700',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
    marginTop: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    padding: 16,
    height: 112,
    justifyContent: 'space-between',
    ...Shadows.sketch,
  },
  statCardLeft: {
    borderRadius: 24,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 24,
  },
  statCardRight: {
    borderRadius: 8,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 8,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
    color: Colors.textMuted,
  },
  statValue: {
    fontFamily: 'monospace',
    fontSize: 28,
    fontWeight: '700',
    color: Colors.ink,
  },
  statValueViolet: {
    color: Colors.violet,
  },
  statBarBg: {
    height: 6,
    backgroundColor: Colors.paperDark,
    borderRadius: 3,
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statBarCoral: {
    backgroundColor: Colors.coral,
  },
  statTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statTrendIcon: {
    fontSize: 10,
  },
  statTrendText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },

  // Subscriptions
  subsSection: {
    marginTop: 24,
  },
  subsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  subsTitle: {
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: '700',
    color: Colors.ink,
  },
  manageBtn: {
    backgroundColor: `${Colors.accentBlue}33`,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    ...Shadows.sketchSm,
  },
  manageBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.ink,
  },
  subsScroll: {
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 8,
  },
  subCard: {
    alignItems: 'center',
  },
  subCancelBtn: {
    position: 'absolute',
    top: -4,
    left: -4,
    zIndex: 10,
    width: 24,
    height: 24,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.ink,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sketchSm,
  },
  subCancelIcon: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.error,
  },
  subContent: {
    width: 80,
    height: 80,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...Shadows.sketchSm,
  },
  subLogo: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subLogoText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.white,
  },
  subPrice: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: Colors.ink,
  },
  subDue: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ink,
  },
});
