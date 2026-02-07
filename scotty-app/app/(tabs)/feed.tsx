import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import TransactionList from '@/components/TransactionList';
import SpendingChart from '@/components/SpendingChart';
import HealthTab from '@/components/HealthTab';
import GoalWorkshopModal from '@/components/GoalWorkshopModal';
import BudgetBuilderModal from '@/components/BudgetBuilderModal';
import { getSpendingByCategory, getTotalSpending } from '@/services/mockData';

type TabType = 'transactions' | 'analytics' | 'health';

const TABS: { key: TabType; label: string }[] = [
  { key: 'transactions', label: 'TRANSACTIONS' },
  { key: 'analytics', label: 'ANALYTICS' },
  { key: 'health', label: 'HEALTH' },
];

export default function FeedScreen() {
  const { transactions, profile, healthMetrics } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('transactions');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  const insets = useSafeAreaInsets();
  const spending = getSpendingByCategory(transactions);
  const monthlyTotal = getTotalSpending(transactions, 30);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarEmoji}>🐕</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>FINANCES</Text>
            <Text style={styles.headerSub}>TRACKING YOUR LOOT, WOOF!</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerSettingsBtn}>
          <Text style={styles.headerSettingsIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
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

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'transactions' && (
          <TransactionList transactions={transactions} limit={30} />
        )}

        {activeTab === 'analytics' && (
          <SpendingChart
            spending={spending}
            budget={profile.monthlyBudget}
            transactions={transactions}
            balance={profile.currentBalance}
          />
        )}

        {activeTab === 'health' && (
          <HealthTab
            healthMetrics={healthMetrics}
            onStartGoal={() => setShowGoalModal(true)}
            onCreateBudget={() => setShowBudgetModal(true)}
          />
        )}
      </ScrollView>

      {/* Modals */}
      <GoalWorkshopModal
        visible={showGoalModal}
        onClose={() => setShowGoalModal(false)}
      />
      <BudgetBuilderModal
        visible={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
      />
    </View>
  );
}

const FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff6f3',
  },

  // Header
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#fff6f3',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    backgroundColor: '#e1bee7',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  headerAvatarEmoji: { fontSize: 20 },
  headerTitle: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  headerSub: {
    fontFamily: FONT,
    fontSize: 7,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1,
  },
  headerSettingsBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  headerSettingsIcon: {
    fontSize: 18,
    color: '#000',
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeTab: {
    backgroundColor: '#000',
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  tabText: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '900',
    color: '#999',
    letterSpacing: 1,
  },
  activeTabText: {
    color: '#fff',
  },

  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
});
