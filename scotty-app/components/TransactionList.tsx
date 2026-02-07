import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Transaction, TransactionCategory } from '../types';

interface TransactionListProps {
  transactions: Transaction[];
  limit?: number;
}

const CATEGORY_INFO: Record<TransactionCategory, { icon: string; label: string }> = {
  food_dining: { icon: '🍔', label: 'Food & Dining' },
  groceries: { icon: '🛒', label: 'Groceries' },
  transport: { icon: '🚗', label: 'Transport' },
  entertainment: { icon: '🎮', label: 'Entertainment' },
  shopping: { icon: '🛍️', label: 'Shopping' },
  subscriptions: { icon: '📱', label: 'Subscriptions' },
  utilities: { icon: '💡', label: 'Utilities' },
  education: { icon: '📚', label: 'Education' },
  health: { icon: '💊', label: 'Health' },
  other: { icon: '💰', label: 'Other' },
};

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const categoryInfo = CATEGORY_INFO[transaction.category];

  return (
    <View style={styles.transactionItem}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{categoryInfo.icon}</Text>
      </View>

      <View style={styles.details}>
        <Text style={styles.merchant}>{transaction.merchant}</Text>
        <Text style={styles.category}>{categoryInfo.label}</Text>
      </View>

      <View style={styles.amountContainer}>
        <Text style={styles.amount}>-${transaction.amount.toFixed(2)}</Text>
        <Text style={styles.time}>{formatTime(transaction.date)}</Text>
      </View>
    </View>
  );
}

export function TransactionList({ transactions, limit }: TransactionListProps) {
  // Group transactions by date
  const groupedTransactions = transactions
    .slice(0, limit)
    .reduce((groups, transaction) => {
      const dateKey = formatDate(transaction.date);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(transaction);
      return groups;
    }, {} as Record<string, Transaction[]>);

  const sections = Object.entries(groupedTransactions).map(([date, items]) => ({
    date,
    items,
    total: items.reduce((sum, t) => sum + t.amount, 0),
  }));

  return (
    <View style={styles.container}>
      {sections.map((section) => (
        <View key={section.date} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionDate}>{section.date}</Text>
            <Text style={styles.sectionTotal}>-${section.total.toFixed(2)}</Text>
          </View>
          {section.items.map((transaction) => (
            <TransactionItem key={transaction.id} transaction={transaction} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  sectionDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  sectionTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  details: {
    flex: 1,
  },
  merchant: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  category: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});

export default TransactionList;
