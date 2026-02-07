import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TransactionCategory } from '../types';

interface SpendingChartProps {
  spending: Partial<Record<TransactionCategory, number>>;
  budget?: number;
}

const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  food_dining: '#EF4444',
  groceries: '#22C55E',
  transport: '#3B82F6',
  entertainment: '#A855F7',
  shopping: '#F97316',
  subscriptions: '#06B6D4',
  utilities: '#6366F1',
  education: '#EC4899',
  health: '#14B8A6',
  other: '#6B7280',
};

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  food_dining: 'Food & Dining',
  groceries: 'Groceries',
  transport: 'Transport',
  entertainment: 'Entertainment',
  shopping: 'Shopping',
  subscriptions: 'Subscriptions',
  utilities: 'Utilities',
  education: 'Education',
  health: 'Health',
  other: 'Other',
};

export function SpendingChart({ spending, budget }: SpendingChartProps) {
  const entries = Object.entries(spending)
    .filter(([, amount]) => amount && amount > 0)
    .sort(([, a], [, b]) => (b || 0) - (a || 0)) as [TransactionCategory, number][];

  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);

  // Calculate percentages for the pie chart
  let currentAngle = 0;
  const slices = entries.map(([category, amount]) => {
    const percentage = (amount / total) * 100;
    const startAngle = currentAngle;
    currentAngle += (percentage / 100) * 360;
    return {
      category,
      amount,
      percentage,
      startAngle,
      endAngle: currentAngle,
      color: CATEGORY_COLORS[category],
    };
  });

  // Create a simple horizontal bar representation (more reliable than SVG for RN)
  return (
    <View style={styles.container}>
      {/* Total Spending */}
      <View style={styles.header}>
        <Text style={styles.totalLabel}>Total Spent</Text>
        <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
        {budget && (
          <Text style={[
            styles.budgetStatus,
            total > budget ? styles.overBudget : styles.underBudget
          ]}>
            {total > budget
              ? `$${(total - budget).toFixed(0)} over budget`
              : `$${(budget - total).toFixed(0)} remaining`}
          </Text>
        )}
      </View>

      {/* Visual bar chart */}
      <View style={styles.barChart}>
        {slices.map((slice) => (
          <View
            key={slice.category}
            style={[
              styles.barSegment,
              {
                flex: slice.percentage,
                backgroundColor: slice.color,
              },
            ]}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {slices.slice(0, 6).map((slice) => (
          <View key={slice.category} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
            <View style={styles.legendText}>
              <Text style={styles.legendCategory}>
                {CATEGORY_LABELS[slice.category]}
              </Text>
              <Text style={styles.legendAmount}>
                ${slice.amount.toFixed(0)} ({slice.percentage.toFixed(0)}%)
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Budget progress bar */}
      {budget && (
        <View style={styles.budgetSection}>
          <View style={styles.budgetHeader}>
            <Text style={styles.budgetLabel}>Budget Progress</Text>
            <Text style={styles.budgetValue}>
              ${total.toFixed(0)} / ${budget.toFixed(0)}
            </Text>
          </View>
          <View style={styles.budgetBar}>
            <View
              style={[
                styles.budgetFill,
                {
                  width: `${Math.min(100, (total / budget) * 100)}%`,
                  backgroundColor: total > budget ? '#EF4444' : '#22C55E',
                },
              ]}
            />
            {total > budget && (
              <View
                style={[
                  styles.budgetOverflow,
                  {
                    width: `${Math.min(50, ((total - budget) / budget) * 100)}%`,
                  },
                ]}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
  },
  budgetStatus: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  overBudget: {
    color: '#EF4444',
  },
  underBudget: {
    color: '#22C55E',
  },
  barChart: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
  },
  barSegment: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%',
    marginBottom: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    flex: 1,
  },
  legendCategory: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  legendAmount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  budgetSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  budgetValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  budgetBar: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  budgetFill: {
    height: '100%',
    borderRadius: 5,
  },
  budgetOverflow: {
    height: '100%',
    backgroundColor: '#FCA5A5',
  },
});

export default SpendingChart;
