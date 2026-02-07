import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { useApp } from '@/context/AppContext';
import { fetchBudgets } from '@/services/api';
import {
  getTotalSpending,
  getTopSpendingCategories,
} from '@/services/transactionMetrics';
import { TransactionCategory } from '@/types';

function PixelScotty({ size }: { size: number }) {
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
      <Path d="M6 5 h2 v3 h-2 z M16 5 h2 v3 h-2 z" fill="#4a3728" />
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
      {/* Tongue */}
      <Path d="M8 17h8v1h-8z" fill="#ffab91" />
    </Svg>
  );
}

export default function ScottyHomeScreen() {
  const { dailyInsight, scottyState, profile, transactions } = useApp();
  const [activeBudgetTab, setActiveBudgetTab] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [budgets, setBudgets] = useState<Array<{
    category: string;
    amount: number;
    spent: number;
    period: string;
  }>>([]);

  useEffect(() => {
    let isMounted = true;
    fetchBudgets()
      .then((rows) => {
        if (isMounted) setBudgets(rows);
      })
      .catch(() => {
        if (isMounted) setBudgets([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const monthlyTotal = useMemo(() => getTotalSpending(transactions, 30), [transactions]);
  const budgetDelta = profile.monthlyBudget - monthlyTotal;
  const happinessPct = Math.max(0, Math.min(100, scottyState.happiness));

  const todaySpending = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return transactions
      .filter((tx) => tx.date.toISOString().slice(0, 10) === today)
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const topCategoryCounts = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const counts: Partial<Record<TransactionCategory, number>> = {};
    for (const tx of transactions) {
      if (tx.date < weekAgo) continue;
      counts[tx.category] = (counts[tx.category] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => (b || 0) - (a || 0))
      .slice(0, 3)
      .map(([category, count]) => ({
        category: category as TransactionCategory,
        count: count || 0,
      }));
  }, [transactions]);

  const fallbackBudgetCards = useMemo(() => {
    return getTopSpendingCategories(transactions, 3).map((item) => ({
      category: formatCategoryName(item.category),
      amount: Math.max(50, Math.round(item.amount * 1.2)),
      spent: item.amount,
      period: 'monthly',
    }));
  }, [transactions]);

  const displayBudgets =
    budgets.length > 0
      ? budgets
      : fallbackBudgetCards.length > 0
      ? fallbackBudgetCards
      : [
          { category: 'Entertainment', amount: 100, spent: 0, period: 'monthly' },
          { category: 'Food & Drink', amount: 400, spent: 0, period: 'monthly' },
          { category: 'Shopping', amount: 200, spent: 0, period: 'monthly' },
        ];

  const heroIcons = [0, 1, 2].map((idx) => {
    const category = topCategoryCounts[idx]?.category || 'other';
    const count = topCategoryCounts[idx]?.count || 0;
    return { emoji: categoryEmoji(category), count };
  });

  const goalCards = displayBudgets.slice(0, 3);
  const dashboardCards = displayBudgets.slice(0, 3).map((item) => {
    const scale = getBudgetScale(activeBudgetTab, new Date());
    const amount = Math.max(1, item.amount * scale);
    const spent = item.spent * scale;
    const progressPct = Math.max(0, Math.min(100, (spent / amount) * 100));
    const projectedPct = Math.max(0, Math.round((projectProjectedSpent(item.spent) / Math.max(1, item.amount)) * 100));
    return {
      ...item,
      amount,
      spent,
      progressPct,
      projectedPct,
      warning: projectedPct > 100,
    };
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.speechBubble}>
          <Text style={styles.speechText}>
            "{dailyInsight?.message || 'Save some kibble for later!'}"
          </Text>
          <View style={styles.speechTail} />
        </View>

        <View style={styles.heroContent}>
          <View style={styles.dogContainer}>
            <View style={styles.scottyWrapper}>
              <PixelScotty size={160} />
            </View>
          </View>

          <View style={styles.categoryIcons}>
            <View style={[styles.iconCard, styles.iconCardPurple]}>
              <Text style={styles.iconEmoji}>{heroIcons[0].emoji}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{heroIcons[0].count}x</Text>
              </View>
            </View>
            <View style={[styles.iconCard, styles.iconCardYellow]}>
              <Text style={styles.iconEmoji}>{heroIcons[1].emoji}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{heroIcons[1].count}x</Text>
              </View>
            </View>
            <View style={[styles.iconCard, styles.iconCardGreen]}>
              <Text style={styles.iconEmoji}>{heroIcons[2].emoji}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{heroIcons[2].count}x</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Happiness Meter */}
        <View style={styles.happinessContainer}>
          <View style={styles.meterHeader}>
            <Text style={styles.meterLabel}>SCOTTY HAPPINESS</Text>
            <Text style={styles.meterValue}>{happinessPct}%</Text>
          </View>
          <View style={styles.meterContainer}>
            <LinearGradient
              colors={['#ff6b6b', '#9b59b6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.meterFill, { width: `${happinessPct}%` }]}
            />
          </View>
        </View>
      </View>

      {/* Savings Goals Section */}
      <View style={styles.section}>
        {goalCards.map((item, idx) => {
          const pct = Math.max(0, Math.min(100, (item.spent / Math.max(1, item.amount)) * 100));
          const iconStyle = idx === 1 ? styles.goalIconBlue : idx === 2 ? styles.goalIconGreen : undefined;
          const barStyle = idx === 1 ? styles.progressPurple : idx === 2 ? styles.progressBlue : styles.progressOrange;
          return (
            <View key={`${item.category}_${idx}`} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <View style={[styles.goalIcon, iconStyle]}>
                  <Text style={styles.goalIconText}>{categoryEmojiFromName(item.category)}</Text>
                </View>
                <Text style={styles.goalTitle}>{item.category.toUpperCase()} FUND</Text>
              </View>
              <Text style={styles.goalAmount}>${item.spent.toFixed(0)} / ${item.amount.toFixed(0)}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, barStyle, { width: `${pct}%` }]} />
              </View>
            </View>
          );
        })}
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>DAILY SPEND</Text>
          <Text style={styles.summaryValueLarge}>${todaySpending.toFixed(2)}</Text>
          <View style={styles.smallProgressBar}>
            <View
              style={[
                styles.smallProgressFill,
                { width: `${Math.min(100, (todaySpending / Math.max(1, profile.monthlyBudget / 30)) * 100)}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>BANK TOTAL</Text>
          <Text style={[styles.summaryValueLarge, styles.summaryValuePurple]}>
            ${profile.currentBalance.toFixed(0)}
          </Text>
          <Text style={styles.todayIncome}>
            {budgetDelta >= 0 ? '↗' : '↘'} {budgetDelta >= 0 ? '+' : '-'}$
            {Math.abs(budgetDelta).toFixed(0)} this month
          </Text>
        </View>
      </View>

      {/* Budget Dashboard */}
      <View style={styles.budgetSection}>
        <View style={styles.budgetHeader}>
          <Text style={styles.budgetTitle}>BUDGET DASHBOARD</Text>
          <TouchableOpacity>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          {(['Daily', 'Weekly', 'Monthly'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeBudgetTab === tab && styles.tabActive
              ]}
              onPress={() => setActiveBudgetTab(tab)}
            >
              <Text style={[
                styles.tabText,
                activeBudgetTab === tab && styles.tabTextActive
              ]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {dashboardCards.map((item, idx) => {
          const barStyle = idx === 0 ? styles.progressPurple : idx === 1 ? styles.progressOrange : styles.progressBlue;
          return (
            <View key={`${item.category}_dashboard_${idx}`} style={styles.budgetCard}>
              <View style={styles.budgetCategoryHeader}>
                <View style={styles.budgetCategoryLeft}>
                  <Text style={styles.budgetEmoji}>{categoryEmojiFromName(item.category)}</Text>
                  <Text style={styles.budgetCategoryName}>{item.category}</Text>
                </View>
                <Text style={styles.budgetCategoryAmount}>
                  ${item.spent.toFixed(2)} / ${item.amount.toFixed(2)}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, barStyle, { width: `${item.progressPct}%` }]} />
              </View>
              <Text style={[styles.budgetProjection, item.warning && styles.budgetProjectionWarning]}>
                Projected End: {item.projectedPct}%
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function getBudgetScale(tab: 'Daily' | 'Weekly' | 'Monthly', now: Date): number {
  if (tab === 'Monthly') return 1;
  if (tab === 'Weekly') return 1 / 4.345;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return 1 / daysInMonth;
}

function projectProjectedSpent(currentSpent: number): number {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = Math.max(0.1, dayOfMonth / daysInMonth);
  return currentSpent / elapsed;
}

function formatCategoryName(category: string): string {
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (s) => s.toUpperCase());
}

function categoryEmoji(category: TransactionCategory): string {
  const byCategory: Record<TransactionCategory, string> = {
    food_dining: '🍔',
    groceries: '🛒',
    transport: '🚗',
    entertainment: '🎭',
    shopping: '🛍️',
    subscriptions: '📺',
    utilities: '💡',
    education: '📚',
    health: '💊',
    other: '🐾',
  };
  return byCategory[category];
}

function categoryEmojiFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('food') || lower.includes('dining')) return '🍔';
  if (lower.includes('shop')) return '🛍️';
  if (lower.includes('entertain')) return '🎭';
  if (lower.includes('transport') || lower.includes('travel')) return '🚗';
  if (lower.includes('groc')) return '🛒';
  if (lower.includes('util')) return '💡';
  if (lower.includes('subscript')) return '📺';
  if (lower.includes('health')) return '💊';
  return '🐾';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff6f3',
  },
  content: {
    paddingBottom: 20,
  },

  // Hero Section
  heroSection: {
    padding: 20,
  },
  speechBubble: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 20,
    padding: 12,
    marginBottom: 20,
    position: 'relative',
    alignSelf: 'flex-start',
    maxWidth: '50%',
    transform: [{ rotate: '-2deg' }],
  },
  speechText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000',
    lineHeight: 16,
  },
  speechTail: {
    position: 'absolute',
    bottom: -10,
    right: 16,
    width: 20,
    height: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#000',
    transform: [{ rotate: '45deg' }],
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  dogContainer: {
    flex: 1,
    alignItems: 'center',
  },
  scottyWrapper: {
    overflow: 'hidden',
  },
  categoryIcons: {
    gap: 12,
  },
  iconCard: {
    width: 56,
    height: 56,
    backgroundColor: '#e1bee7',
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
  iconCardYellow: {
    backgroundColor: '#fff9c4',
  },
  iconCardPurple: {
    backgroundColor: '#e1bee7',
  },
  iconCardGreen: {
    backgroundColor: '#c8e6c9',
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
  badgeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 8,
    fontWeight: '900',
    color: '#fff',
  },

  // Happiness Meter
  happinessContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  meterLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 2,
  },
  meterValue: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  meterContainer: {
    height: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  meterFill: {
    height: '100%',
    borderRadius: 999,
  },

  // Section Styles
  section: {
    paddingHorizontal: 20,
    gap: 12,
  },

  // Goal Cards
  goalCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  goalIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#fff9c4',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalIconBlue: {
    backgroundColor: '#bbdefb',
  },
  goalIconGreen: {
    backgroundColor: '#c8e6c9',
  },
  goalIconText: {
    fontSize: 20,
  },
  goalTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
  },
  goalAmount: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    color: '#ff6b6b',
    position: 'absolute',
    top: 16,
    right: 16,
  },
  progressBar: {
    height: 20,
    backgroundColor: '#ffece6',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressOrange: {
    backgroundColor: '#ff8a65',
  },
  progressPurple: {
    backgroundColor: '#9b59b6',
  },
  progressBlue: {
    backgroundColor: '#81d4fa',
  },

  // Summary Cards
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 16,
    marginTop: 24,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 20,
    padding: 16,
    minHeight: 110,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  summaryLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 9,
    fontWeight: '900',
    color: '#999',
    letterSpacing: 2,
    marginBottom: 8,
  },
  summaryValueLarge: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  summaryValuePurple: {
    color: '#9b59b6',
  },
  smallProgressBar: {
    height: 6,
    backgroundColor: '#ffece6',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 12,
  },
  smallProgressFill: {
    height: '100%',
    backgroundColor: '#ff6b6b',
    borderRadius: 3,
  },
  todayIncome: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: '#4caf50',
    marginTop: 8,
  },

  // Budget Dashboard
  budgetSection: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 24,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  budgetTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
  },
  settingsIcon: {
    fontSize: 20,
    color: '#999',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#000',
  },
  tabText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
  },
  tabTextActive: {
    color: '#fff',
  },
  budgetCard: {
    marginBottom: 24,
  },
  budgetCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetCategoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  budgetEmoji: {
    fontSize: 20,
  },
  budgetCategoryName: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  budgetCategoryAmount: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: '#666',
  },
  budgetProjection: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: '#4caf50',
    fontStyle: 'italic',
    marginTop: 4,
  },
  budgetProjectionWarning: {
    color: '#ff6b6b',
  },
});
