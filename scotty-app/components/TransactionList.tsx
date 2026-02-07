import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Transaction, TransactionCategory } from '../types';

interface TransactionListProps {
  transactions: Transaction[];
  limit?: number;
}

const CATEGORY_INFO: Record<TransactionCategory, { icon: string; label: string; color: string }> = {
  food_dining: { icon: '☕', label: 'DINING', color: '#fff9c4' },
  groceries: { icon: '🛒', label: 'GROCERIES', color: '#c8e6c9' },
  transport: { icon: '🚗', label: 'TRANSPORT', color: '#bbdefb' },
  entertainment: { icon: '🎭', label: 'ENTERTAINMENT', color: '#e1bee7' },
  shopping: { icon: '🛍️', label: 'SHOPPING', color: '#fff9c4' },
  subscriptions: { icon: '📱', label: 'SUBSCRIPTION', color: '#bbdefb' },
  utilities: { icon: '💡', label: 'UTILITIES', color: '#bbdefb' },
  education: { icon: '📚', label: 'EDUCATION', color: '#c8e6c9' },
  health: { icon: '💊', label: 'HEALTH', color: '#f8bbd0' },
  other: { icon: '💰', label: 'OTHER', color: '#ffece6' },
};

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  if (days < 7) return `${days} DAYS AGO`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function TransactionCard({ transaction }: { transaction: Transaction }) {
  const info = CATEGORY_INFO[transaction.category];
  const isRecurring = transaction.isSubscription;
  const isNew = (new Date().getTime() - transaction.date.getTime()) < 1000 * 60 * 60 * 6; // within 6 hours
  const isBill = transaction.amount >= 100;

  return (
    <View style={styles.card}>
      <View style={[styles.cardIcon, { backgroundColor: info.color }]}>
        <Text style={styles.cardIconText}>{info.icon}</Text>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.merchantName} numberOfLines={1}>
            {transaction.merchant.toUpperCase()}
          </Text>
          {isNew && (
            <View style={styles.tagNew}>
              <Text style={styles.tagText}>NEW</Text>
            </View>
          )}
          {isRecurring && (
            <View style={styles.tagRecurring}>
              <Text style={styles.tagText}>RECURRING</Text>
            </View>
          )}
          {isBill && !isRecurring && (
            <View style={styles.tagBill}>
              <Text style={styles.tagText}>BILL</Text>
            </View>
          )}
        </View>
        <Text style={styles.categoryLabel}>
          {info.label} · {formatTime(transaction.date)}
        </Text>
      </View>

      <View style={styles.amountBadge}>
        <Text style={styles.amountText}>-${transaction.amount.toFixed(2)}</Text>
      </View>
    </View>
  );
}

export function TransactionList({ transactions, limit }: TransactionListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = transactions
    .slice(0, limit)
    .filter((t) =>
      searchQuery === '' ||
      t.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      CATEGORY_INFO[t.category].label.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Group by date
  const grouped = filtered.reduce((groups, transaction) => {
    const dateKey = formatDate(transaction.date);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const sections = Object.entries(grouped).map(([date, items]) => ({
    date,
    items,
  }));

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Find that kibble receipt..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={[styles.filterButton, styles.filterButtonDisabled]} disabled={true}>
            <Text style={[styles.filterIcon, styles.filterIconDisabled]}>🐾</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.searchHint}>"Sniffing out your spending patterns, human!"</Text>
      </View>

      {/* Transaction Sections */}
      {sections.map((section) => (
        <View key={section.date} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionDateText}>{section.date}</Text>
            </View>
          </View>
          {section.items.map((transaction) => (
            <TransactionCard key={transaction.id} transaction={transaction} />
          ))}
        </View>
      ))}
    </View>
  );
}

const FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 20,
  },

  // Search
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    padding: 0,
  },
  filterButton: {
    width: 32,
    height: 32,
    backgroundColor: '#fff9c4',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: {
    fontSize: 14,
  },  filterButtonDisabled: {
    opacity: 0.4,
  },
  filterIconDisabled: {
    opacity: 0.6,
  },  searchHint: {
    fontFamily: FONT,
    fontSize: 9,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 6,
    marginLeft: 4,
  },

  // Sections
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sectionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#000',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionDateText: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },

  // Transaction Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    // Slight skew for sketch feel
    transform: [{ rotate: '-0.3deg' }],
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardIconText: {
    fontSize: 20,
  },
  cardContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  merchantName: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  categoryLabel: {
    fontFamily: FONT,
    fontSize: 9,
    color: '#999',
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // Tags
  tagNew: {
    backgroundColor: '#fff9c4',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagRecurring: {
    backgroundColor: '#e1bee7',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagBill: {
    backgroundColor: '#ff6b6b',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagText: {
    fontFamily: FONT,
    fontSize: 7,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },

  // Amount
  amountBadge: {
    backgroundColor: '#ffece6',
    borderWidth: 1.5,
    borderColor: '#ff6b6b',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  amountText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '900',
    color: '#ff6b6b',
  },
});

export default TransactionList;
