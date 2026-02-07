import React, { useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import TransactionList from '@/components/TransactionList';
import SpendingChart from '@/components/SpendingChart';
import HealthTab from '@/components/HealthTab';
import GoalWorkshopModal from '@/components/GoalWorkshopModal';
import BudgetBuilderModal from '@/components/BudgetBuilderModal';
import { getSpendingByCategory, getTotalSpending } from '@/services/transactionMetrics';

type TabType = 'transactions' | 'analytics' | 'health';

const TABS: { key: TabType; label: string }[] = [
  { key: 'transactions', label: 'TRANSACTIONS' },
  { key: 'analytics', label: 'ANALYTICS' },
  { key: 'health', label: 'HEALTH' },
];

export default function FeedScreen() {
  const navigation = useNavigation();
  const {
    transactions,
    profile,
    healthMetrics,
    dailyInsight,
    dailySpend,
    accounts,
    totalBalance,
    spendingTrend,
    quests,
    upcomingBills,
  } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('transactions');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const pagerRef = useRef<ScrollView>(null);

  const insets = useSafeAreaInsets();
  const headerOffset = Platform.OS === 'ios' ? -2 : 0;
  const headerTextOffset = Platform.OS === 'ios' ? -3 : 0;
  const spending = getSpendingByCategory(transactions);
  const monthlyTotal = getTotalSpending(transactions, 30);
  const pageWidth = useMemo(() => Dimensions.get('window').width, []);

  const handleTabPress = (tab: TabType) => {
    const index = TABS.findIndex((item) => item.key === tab);
    if (index >= 0) {
      pagerRef.current?.scrollTo({ x: index * pageWidth, animated: true });
    }
    setActiveTab(tab);
  };

  const handleSwipeEnd = (offsetX: number) => {
    const index = Math.round(offsetX / pageWidth);
    const nextTab = TABS[index]?.key;
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + headerOffset,
            height: insets.top + 56 + headerOffset,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarEmoji}>🐕</Text>
          </View>
          <View style={[styles.headerTextStack, { marginTop: headerTextOffset }]}>
            <Text style={styles.headerTitle}>FINANCES</Text>
          </View>
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => handleTabPress(tab.key)}
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
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => handleSwipeEnd(event.nativeEvent.contentOffset.x)}
        style={styles.pager}
        contentContainerStyle={styles.pagerContent}
      >
        <ScrollView
          style={[styles.content, { width: pageWidth }]}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <TransactionList transactions={transactions} limit={30} />
        </ScrollView>

        <ScrollView
          style={[styles.content, { width: pageWidth }]}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <SpendingChart
            spending={spending}
            budget={profile.monthlyBudget}
            transactions={transactions}
            balance={profile.currentBalance}
            dailyInsight={dailyInsight}
            dailySpend={dailySpend}
            accounts={accounts}
            totalBalance={totalBalance}
            spendingTrend={spendingTrend}
            quests={quests}
          />
        </ScrollView>

        <ScrollView
          style={[styles.content, { width: pageWidth }]}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <HealthTab
            healthMetrics={healthMetrics}
            onStartGoal={() => setShowGoalModal(true)}
            onCreateBudget={() => setShowBudgetModal(true)}
            upcomingBills={upcomingBills}
            dailyInsight={dailyInsight}
          />
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 8,
    backgroundColor: '#fff6f3',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTextStack: {
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 20,
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
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
    lineHeight: 18,
  },
  headerSub: {
    fontFamily: FONT,
    fontSize: 7,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1,
    lineHeight: 9,
    marginTop: -1,
  },
  headerRightSpacer: {
    width: 40,
    height: 40,
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
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1,
  },
  activeTabText: {
    color: '#fff',
  },

  pager: {
    flex: 1,
  },
  pagerContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
});
