import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';

import { useApp } from '@/context/AppContext';
import TransactionList from '@/components/TransactionList';
import SpendingChart from '@/components/SpendingChart';
import { getSpendingByCategory, getTotalSpending } from '@/services/transactionMetrics';

type TabType = 'transactions' | 'analytics' | 'health';

export default function FeedScreen() {
  const { transactions, profile, healthMetrics } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('transactions');

  const spending = getSpendingByCategory(transactions);
  const monthlyTotal = getTotalSpending(transactions, 30);

  const tabs: { key: TabType; label: string }[] = [
    { key: 'transactions', label: 'Transactions' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'health', label: 'Health' },
  ];

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'transactions' && (
          <>
            {/* Monthly Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>This Month</Text>
              <Text style={styles.summaryAmount}>
                ${monthlyTotal.toFixed(2)}
              </Text>
              <Text style={styles.summaryBudget}>
                of ${profile.monthlyBudget.toFixed(0)} budget
              </Text>
            </View>

            {/* Transaction List */}
            <TransactionList transactions={transactions} limit={30} />
          </>
        )}

        {activeTab === 'analytics' && (
          <>
            <SpendingChart spending={spending} budget={profile.monthlyBudget} />

            {/* Category Breakdown */}
            <View style={styles.categorySection}>
              <Text style={styles.sectionTitle}>Category Insights</Text>

              {Object.entries(spending)
                .filter(([, amount]) => amount > 0)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([category, amount]) => {
                  const percentage = (amount / monthlyTotal) * 100;
                  return (
                    <View key={category} style={styles.categoryItem}>
                      <View style={styles.categoryInfo}>
                        <Text style={styles.categoryName}>
                          {category.replace('_', ' ')}
                        </Text>
                        <Text style={styles.categoryPercentage}>
                          {percentage.toFixed(0)}% of spending
                        </Text>
                      </View>
                      <Text style={styles.categoryAmount}>
                        ${amount.toFixed(0)}
                      </Text>
                    </View>
                  );
                })}
            </View>
          </>
        )}

        {activeTab === 'health' && (
          <View style={styles.healthSection}>
            <Text style={styles.sectionTitle}>Financial Health Score</Text>

            <View style={styles.overallScore}>
              <Text style={styles.scoreValue}>{healthMetrics.overallScore}</Text>
              <Text style={styles.scoreLabel}>/ 100</Text>
            </View>

            <View style={styles.metricsGrid}>
              <MetricCard
                label="Budget Adherence"
                value={healthMetrics.budgetAdherence}
                description="How well you stick to your budget"
              />
              <MetricCard
                label="Savings Rate"
                value={healthMetrics.savingsRate}
                description="Percentage going to savings"
              />
              <MetricCard
                label="Impulse Control"
                value={healthMetrics.impulseScore}
                description="Avoiding impulse purchases"
              />
            </View>

            <View style={styles.tipsSection}>
              <Text style={styles.tipsTitle}>Tips to Improve</Text>
              {healthMetrics.budgetAdherence < 70 && (
                <Text style={styles.tip}>
                  • Try setting daily spending limits to stay on budget
                </Text>
              )}
              {healthMetrics.savingsRate < 50 && (
                <Text style={styles.tip}>
                  • Automate transfers to savings at the start of each month
                </Text>
              )}
              {healthMetrics.impulseScore < 60 && (
                <Text style={styles.tip}>
                  • Wait 24 hours before making non-essential purchases
                </Text>
              )}
              {healthMetrics.overallScore >= 70 && (
                <Text style={styles.tip}>
                  • Great job! Keep up the good financial habits!
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  const getColor = (v: number) => {
    if (v >= 70) return '#22C55E';
    if (v >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: getColor(value) }]}>
        {value}%
      </Text>
      <Text style={styles.metricDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#EEF2FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#6366F1',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#6366F1',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  summaryBudget: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  categorySection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  categoryPercentage: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  healthSection: {
    padding: 16,
  },
  overallScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 16,
    marginBottom: 16,
  },
  scoreValue: {
    fontSize: 64,
    fontWeight: '700',
    color: '#6366F1',
  },
  scoreLabel: {
    fontSize: 24,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  metricsGrid: {
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    marginVertical: 4,
  },
  metricDescription: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  tipsSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  tip: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 8,
  },
});
