import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { TransactionCategory, Transaction } from '../types';

interface SpendingChartProps {
  spending: Partial<Record<TransactionCategory, number>>;
  budget?: number;
  transactions?: Transaction[];
  balance?: number;
}

const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  food_dining: '#ff6b6b',
  groceries: '#4caf50',
  transport: '#81d4fa',
  entertainment: '#9b59b6',
  shopping: '#ff9800',
  subscriptions: '#e1bee7',
  utilities: '#bbdefb',
  education: '#c8e6c9',
  health: '#f8bbd0',
  other: '#999',
};

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  food_dining: 'Dining',
  groceries: 'Groceries',
  transport: 'Transport',
  entertainment: 'Entertainment',
  shopping: 'Shopping',
  subscriptions: 'Subs',
  utilities: 'Utilities',
  education: 'Education',
  health: 'Health',
  other: 'Other',
};

export function SpendingChart({ spending, budget, transactions = [], balance = 2410 }: SpendingChartProps) {
  const entries = Object.entries(spending)
    .filter(([, amount]) => amount && amount > 0)
    .sort(([, a], [, b]) => (b || 0) - (a || 0)) as [TransactionCategory, number][];

  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  const topCategory = entries[0];
  const top3 = entries.slice(0, 3);

  // Insight message
  const insightCategory = topCategory ? CATEGORY_LABELS[topCategory[0]] : 'spending';
  const insightMessage = `"Yo! Your dining spending is up 12% this week. Your savings goals are waiting for you!"`;

  // Generate last 6 months
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (5 - i));
    return d.toLocaleString('en-US', { month: 'short' });
  });
  const savingsData = [320, 280, 410, 350, 390, 450];
  const maxSavings = Math.max(...savingsData);
  
  // Current month/year for donut subtitle
  const currentMonthYear = now.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

  // Daily spend
  const dailySpend = transactions.length > 0
    ? transactions.filter(t => {
        const now = new Date();
        return t.date.toDateString() === now.toDateString();
      }).reduce((s, t) => s + t.amount, 0)
    : 42.5;

  return (
    <View style={styles.container}>
      {/* Insight Bubble */}
      <View style={styles.insightCard}>
        <View style={styles.insightAvatar}>
          <Text style={styles.insightAvatarText}>🐕</Text>
        </View>
        <View style={styles.insightContent}>
          <Text style={styles.insightText}>{insightMessage}</Text>
          <View style={styles.insightActions}>
            <View style={styles.insightButton}>
              <Text style={styles.insightButtonText}>VIEW TIP</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Accounts & Balances */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEmoji}>💰</Text>
        <Text style={styles.sectionTitle}>Accounts & Balances</Text>
      </View>

      <View style={styles.balanceRow}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>MAIN SAVINGS</Text>
          <Text style={styles.balanceAmount}>${(balance * 3.5).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</Text>
          <View style={styles.balanceChipRow}>
            <View style={[styles.balanceChip, { backgroundColor: '#c8e6c9' }]}>
              <Text style={styles.balanceChipText}>My 💰</Text>
            </View>
            <View style={[styles.balanceChip, { backgroundColor: '#bbdefb' }]}>
              <Text style={styles.balanceChipText}>🏦</Text>
            </View>
          </View>
        </View>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>DAILY SPENDING</Text>
          <Text style={styles.balanceAmount}>${balance > 1000 ? '1,250' : balance.toFixed(0)}</Text>
          <View style={styles.balanceChipRow}>
            <View style={[styles.balanceChip, { backgroundColor: '#ffece6' }]}>
              <Text style={styles.balanceChipText}>Card 💳</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.balanceRowSmall}>
        <View style={styles.balanceCardSmall}>
          <Text style={styles.balanceLabelSmall}>SPENDABLE MONEY</Text>
          <Text style={styles.balanceAmountSmall}>${(dailySpend * 10).toFixed(0)}</Text>
          <Text style={styles.balanceSubtext}>Left til end of month</Text>
        </View>
        <View style={styles.balanceCardSmall}>
          <Text style={styles.balanceLabelSmall}>CREDIT CARD</Text>
          <Text style={styles.balanceAmountSmall}>${(Math.round(balance * 0.15)).toFixed(0)}</Text>
          <Text style={styles.balanceSubtext}>Due soon</Text>
        </View>
      </View>

      {/* Spending Analysis Donut */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEmoji}>🎯</Text>
        <Text style={styles.sectionTitle}>Spending Analysis</Text>
      </View>

      <View style={styles.donutCard}>
        <View style={styles.donutHeader}>
          <View>
            <Text style={styles.donutTitle}>Monthly Distribution</Text>
            <Text style={styles.donutSubtitle}>{currentMonthYear} OVERVIEW</Text>
          </View>
          <Text style={styles.donutTotal}>${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</Text>
        </View>

        {/* Simple donut representation */}
        <View style={styles.donutVisual}>
          <View style={styles.donutRing}>
            {/* Colored segments around the ring */}
            {top3.map(([cat, amount], i) => {
              const pct = (amount / total) * 100;
              return (
                <View
                  key={cat}
                  style={[
                    styles.donutSegmentBar,
                    {
                      backgroundColor: CATEGORY_COLORS[cat],
                      width: `${pct}%`,
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.donutCenter}>
            <Text style={styles.donutCenterLabel}>BIGGEST</Text>
            <Text style={styles.donutCenterCategory}>
              {topCategory ? CATEGORY_LABELS[topCategory[0]] : '—'}
            </Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.donutLegend}>
          {top3.map(([cat]) => (
            <View key={cat} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
              <Text style={styles.legendLabel}>{CATEGORY_LABELS[cat].toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 6-Month Trend */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEmoji}>📈</Text>
        <Text style={styles.sectionTitle}>6-Month Trend</Text>
      </View>

      <View style={styles.trendCard}>
        <Text style={styles.trendTitle}>BUDGETED SAVINGS OVER TIME</Text>
        <View style={styles.trendChart}>
          {savingsData.map((value, i) => (
            <View key={i} style={styles.trendBarWrapper}>
              {i === savingsData.length - 1 ? (
                <View
                  style={[
                    styles.trendBar,
                    styles.trendBarPredicted,
                    { height: `${(value / maxSavings) * 100}%` },
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.trendBar,
                    {
                      height: `${(value / maxSavings) * 100}%`,
                      backgroundColor: i >= savingsData.length - 2
                        ? '#f8bbd0'
                        : '#ffece6',
                    },
                  ]}
                />
              )}
              <Text style={styles.trendLabel}>{months[i]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Goal Progress */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEmoji}>⭐</Text>
        <Text style={styles.sectionTitle}>Goal Progress</Text>
      </View>

      <View style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalTitle}>LAPTOP FUND</Text>
          <View style={styles.goalStar}>
            <Text>⭐</Text>
          </View>
        </View>
        <Text style={styles.goalAmount}>
          <Text style={styles.goalAmountBold}>${(balance * 0.5).toFixed(0)}</Text> / ${(balance * 0.83).toFixed(0)}
        </Text>
        <Text style={styles.goalExpected}>EXPECTED: {new Date(now.getFullYear(), now.getMonth() + 3, 15).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}</Text>
        <View style={styles.goalProgressBar}>
          <View style={[styles.goalProgressFill, { width: '60%' }]} />
          <View style={styles.goalProgressDashed} />
        </View>
        <Text style={styles.goalEncouragement}>60% OF THE WAY THERE, KEEP GOING! 🐾</Text>
      </View>
    </View>
  );
}

const FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },

  // Insight
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#fff9c4',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  insightAvatar: {
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  insightAvatarText: { fontSize: 20 },
  insightContent: { flex: 1 },
  insightText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    lineHeight: 16,
  },
  insightActions: {
    flexDirection: 'row',
    marginTop: 6,
  },
  insightButton: {
    backgroundColor: '#000',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  insightButtonText: {
    fontFamily: FONT,
    fontSize: 8,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 8,
    gap: 6,
  },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },

  // Accounts & Balances
  balanceRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 10,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  balanceLabel: {
    fontFamily: FONT,
    fontSize: 8,
    fontWeight: '900',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 4,
  },
  balanceAmount: {
    fontFamily: FONT,
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    marginBottom: 8,
  },
  balanceChipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  balanceChip: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  balanceChipText: {
    fontFamily: FONT,
    fontSize: 8,
    fontWeight: '700',
  },
  balanceRowSmall: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  balanceCardSmall: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  balanceLabelSmall: {
    fontFamily: FONT,
    fontSize: 7,
    fontWeight: '900',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 2,
  },
  balanceAmountSmall: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  balanceSubtext: {
    fontFamily: FONT,
    fontSize: 8,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Donut Chart
  donutCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 20,
    marginHorizontal: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  donutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  donutTitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
  },
  donutSubtitle: {
    fontFamily: FONT,
    fontSize: 9,
    color: '#999',
    letterSpacing: 1,
  },
  donutTotal: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  donutVisual: {
    alignItems: 'center',
    marginBottom: 16,
  },
  donutRing: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
    backgroundColor: '#ffece6',
    borderWidth: 2,
    borderColor: '#000',
  },
  donutSegmentBar: {
    height: '100%',
  },
  donutCenter: {
    marginTop: 10,
    alignItems: 'center',
  },
  donutCenterLabel: {
    fontFamily: FONT,
    fontSize: 9,
    fontWeight: '900',
    color: '#999',
    letterSpacing: 2,
  },
  donutCenterCategory: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  donutLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  legendLabel: {
    fontFamily: FONT,
    fontSize: 8,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },

  // Trend
  trendCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 20,
    marginHorizontal: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  trendTitle: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
    marginBottom: 12,
  },
  trendChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
  },
  trendBarWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  trendBar: {
    width: 28,
    borderRadius: 6,
    borderWidth: 2,
  trendBarPredicted: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#9b59b6',
    borderStyle: 'dashed',
  },
    borderColor: '#000',
    minHeight: 12,
  },
  trendLabel: {
    fontFamily: FONT,
    fontSize: 8,
    fontWeight: '700',
    color: '#999',
    marginTop: 4,
  },

  // Goal Progress
  goalCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 20,
    marginHorizontal: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalTitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  goalStar: {
    width: 32,
    height: 32,
    backgroundColor: '#ff6b6b',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalAmount: {
    fontFamily: FONT,
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  goalAmountBold: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
  },
  goalExpected: {
    fontFamily: FONT,
    fontSize: 9,
    color: '#999',
    letterSpacing: 1,
    marginBottom: 10,
  },
  goalProgressBar: {
    height: 16,
    backgroundColor: '#ffece6',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  goalProgressFill: {
    height: '100%',
    backgroundColor: '#ff6b6b',
  },
  goalProgressDashed: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '40%',
    borderLeftWidth: 2,
    borderLeftColor: '#000',
    borderStyle: 'dashed',
  },
  goalEncouragement: {
    fontFamily: FONT,
    fontSize: 9,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

export default SpendingChart;
