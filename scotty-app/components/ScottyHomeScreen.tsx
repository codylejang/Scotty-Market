import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import AnimatedProgressBar from './AnimatedProgressBar';
import DraggableFoodItem from './DraggableFoodItem';
import HeartBurst from './HeartBurst';
import ScottyQuestsModal from './ScottyQuestsModal';
import { Scotty, ScottyRef } from './Scotty';
import { useApp } from '../context/AppContext';
import { generateDailyQuests } from '../services/mockData';
import { fetchDailyQuests, refreshDailyQuests } from '../services/api';
import { Quest } from '../types';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type BudgetTab = 'Daily' | 'Monthly' | 'Yearly';

const BUDGET_TABS: BudgetTab[] = ['Daily', 'Monthly', 'Yearly'];

// Budget data indexed by tab
const budgetsByTab: Record<BudgetTab, Array<{
  emoji: string;
  name: string;
  spent: number;
  limit: number;
  percent: number;
  projection: number;
  color: string;
}>> = {
  Daily: [
    {
      emoji: '🎭',
      name: 'Entertainment',
      spent: 45.00,
      limit: 60.00,
      percent: 75,
      projection: 92,
      color: '#9b59b6',
    },
    {
      emoji: '🍔',
      name: 'Dining Out',
      spent: 112.00,
      limit: 120.00,
      percent: 93,
      projection: 115,
      color: '#ff8a65',
    },
    {
      emoji: '🛍️',
      name: 'Shopping',
      spent: 20.00,
      limit: 150.00,
      percent: 15,
      projection: 40,
      color: '#81d4fa',
    },
  ],
  Monthly: [
    {
      emoji: '🏠',
      name: 'Housing',
      spent: 1200.00,
      limit: 1500.00,
      percent: 80,
      projection: 80,
      color: '#9b59b6',
    },
    {
      emoji: '🚗',
      name: 'Transportation',
      spent: 300.00,
      limit: 400.00,
      percent: 75,
      projection: 85,
      color: '#ff8a65',
    },
    {
      emoji: '💳',
      name: 'Subscriptions',
      spent: 89.00,
      limit: 150.00,
      percent: 59,
      projection: 70,
      color: '#81d4fa',
    },
  ],
  Yearly: [
    {
      emoji: '🏡',
      name: 'Housing',
      spent: 14400.00,
      limit: 18000.00,
      percent: 80,
      projection: 80,
      color: '#9b59b6',
    },
    {
      emoji: '🚘',
      name: 'Transportation',
      spent: 3600.00,
      limit: 4800.00,
      percent: 75,
      projection: 85,
      color: '#ff8a65',
    },
    {
      emoji: '💳',
      name: 'Subscriptions',
      spent: 1068.00,
      limit: 1800.00,
      percent: 59,
      projection: 70,
      color: '#81d4fa',
    },
  ],
};

interface ScottyHomeScreenProps {
  showQuestsModal?: boolean;
  onCloseQuestsModal?: () => void;
  onOpenQuestsModal?: () => void;
}

export default function ScottyHomeScreen({
  showQuestsModal = false,
  onCloseQuestsModal,
  onOpenQuestsModal,
}: ScottyHomeScreenProps = {}) {
  const { feedScotty, scottyState } = useApp();
  const [activeBudgetTab, setActiveBudgetTab] = useState<BudgetTab>('Daily');
  const budgetPagerRef = useRef<ScrollView>(null);
  const [budgetPagerWidth, setBudgetPagerWidth] = useState(0);

  // Food counts
  const [foodCounts, setFoodCounts] = useState({ coffee: 1, food: 4, pets: 3 });

  // Quests data (no modal state here, controlled by parent)
  const [quests, setQuests] = useState<Quest[]>(generateDailyQuests());
// Fetch quests from API on mount, fallback to mock data
  React.useEffect(() => {
    const loadQuests = async () => {
      try {
        const apiQuests = await fetchDailyQuests();
        setQuests(apiQuests);
      } catch (error) {
        // If API fails, use mock data (already set in initial state)
        console.log('Using mock quests data');
      }
    };
    loadQuests();
  }, []);

  const handleRefreshQuests = useCallback(async () => {
    try {
      const newQuests = await refreshDailyQuests();
      setQuests(newQuests);
    } catch (error) {
      // Fallback to generating new mock data
      setQuests(generateDailyQuests());
    }
  }, []);

  // Scotty position for drop-zone detection
  const [scottyLayout, setScottyLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const scottyRef = useRef<View>(null);
  const scottyAnimRef = useRef<ScottyRef>(null);

  // Heart burst state
  const [heartBurst, setHeartBurst] = useState<{ x: number; y: number } | null>(null);

  // Happiness bar animated width
  const happinessWidth = useSharedValue(0);
  React.useEffect(() => {
    const target = Math.max(0, Math.min(100, scottyState.happiness));
    happinessWidth.value = withDelay(
      200,
      withTiming(target, { duration: 800, easing: Easing.out(Easing.cubic) })
    );
  }, [scottyState.happiness]);
  const happinessAnimStyle = useAnimatedStyle(() => ({
    width: `${happinessWidth.value}%`,
  }));

  const measureScotty = useCallback(() => {
    // Measure in window coords for absolute positioning
    scottyRef.current?.measureInWindow((x, y, width, height) => {
      setScottyLayout({ x, y, width, height });
    });
  }, []);

  const handleScottyLayout = useCallback((e: LayoutChangeEvent) => {
    measureScotty();
  }, [measureScotty]);

  const handleFeed = useCallback(
    (type: 'coffee' | 'food' | 'pets') => {
      if (foodCounts[type] <= 0) return;

      setFoodCounts((prev) => ({ ...prev, [type]: prev[type] - 1 }));

      // Trigger heart burst at Scotty's center
      if (scottyLayout) {
        setHeartBurst({
          x: scottyLayout.x + scottyLayout.width / 2,
          y: scottyLayout.y + scottyLayout.height / 2,
        });
      }

      // Trigger Scotty's loved animation
      scottyAnimRef.current?.showLoved();

      // Call context feedScotty
      feedScotty('treat');
    },
    [foodCounts, scottyLayout, feedScotty]
  );

  const handleBudgetTabPress = useCallback((tab: BudgetTab) => {
    const index = BUDGET_TABS.indexOf(tab);
    if (index >= 0 && budgetPagerWidth > 0) {
      budgetPagerRef.current?.scrollTo({ x: index * budgetPagerWidth, animated: true });
    }
    setActiveBudgetTab(tab);
  }, [budgetPagerWidth]);

  const handleBudgetSwipeEnd = useCallback((offsetX: number) => {
    if (!budgetPagerWidth) return;
    const index = Math.round(offsetX / budgetPagerWidth);
    const nextTab = BUDGET_TABS[index];
    if (nextTab && nextTab !== activeBudgetTab) {
      setActiveBudgetTab(nextTab);
    }
  }, [activeBudgetTab, budgetPagerWidth]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={measureScotty}
        scrollEventThrottle={100}
        onScrollBeginDrag={measureScotty}
        onMomentumScrollEnd={measureScotty}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.speechBubble}>
            <Text style={styles.speechText}>"Save some kibble for later!"</Text>
            <View style={styles.speechTail} />
          </View>

          <View style={styles.heroContent}>
            <View style={styles.dogContainer}>
              <View
                ref={scottyRef}
                style={styles.scottyWrapper}
                onLayout={handleScottyLayout}
              >
                <Scotty ref={scottyAnimRef} size={160} />
              </View>
            </View>

            <View style={styles.categoryIcons}>
              <DraggableFoodItem
                emoji="☕"
                count={foodCounts.coffee}
                bgColor="#e1bee7"
                scottyLayout={scottyLayout}
                onFeed={() => handleFeed('coffee')}
              />
              <DraggableFoodItem
                emoji="🍴"
                count={foodCounts.food}
                bgColor="#fff9c4"
                scottyLayout={scottyLayout}
                onFeed={() => handleFeed('food')}
              />
              <DraggableFoodItem
                emoji="🐾"
                count={foodCounts.pets}
                bgColor="#c8e6c9"
                scottyLayout={scottyLayout}
                onFeed={() => handleFeed('pets')}
              />
            </View>
          </View>

          {/* Happiness Meter */}
          <View style={styles.happinessContainer}>
            <View style={styles.meterHeader}>
              <Text style={styles.meterLabel}>SCOTTY HAPPINESS</Text>
              <Text style={styles.meterValue}>{scottyState.happiness}%</Text>
            </View>
            <View style={styles.meterContainer}>
              <AnimatedLinearGradient
                colors={['#ff6b6b', '#9b59b6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.meterFill, happinessAnimStyle]}
              />
            </View>
          </View>
        </View>

        {/* Daily Quests Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeaderTitle}>DAILY QUESTS</Text>

          <View style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <View style={styles.goalIcon}>
                <Text style={styles.goalIconText}>🍖</Text>
              </View>
              <Text style={styles.goalTitle}>JUICY MEAT FUND</Text>
            </View>
            <Text style={styles.goalAmount}>$45 / $60</Text>
            <AnimatedProgressBar
              targetPercent={75}
              color="#ff8a65"
              delay={100}
            />
          </View>

          <View style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <View style={[styles.goalIcon, styles.goalIconBlue]}>
                <Text style={styles.goalIconText}>☕</Text>
              </View>
              <Text style={styles.goalTitle}>BOBA RUN SAVINGS</Text>
            </View>
            <Text style={styles.goalAmount}>$12 / $30</Text>
            <AnimatedProgressBar
              targetPercent={40}
              color="#9b59b6"
              delay={250}
            />
          </View>

          <View style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <View style={[styles.goalIcon, styles.goalIconGreen]}>
                <Text style={styles.goalIconText}>🍦</Text>
              </View>
              <Text style={styles.goalTitle}>ICE CREAM PARTY</Text>
            </View>
            <Text style={styles.goalAmount}>$24 / $25</Text>
            <AnimatedProgressBar
              targetPercent={96}
              color="#81d4fa"
              delay={400}
            />
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>DAILY SPEND</Text>
            <Text style={styles.summaryValueLarge}>$42.50</Text>
            <AnimatedProgressBar
              targetPercent={65}
              color="#ff6b6b"
              delay={500}
              height={6}
              small
            />
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>BANK TOTAL</Text>
            <Text style={[styles.summaryValueLarge, styles.summaryValuePurple]}>$2,410</Text>
            <Text style={styles.todayIncome}>↗ +$120 today</Text>
          </View>
        </View>

        {/* Budget Dashboard */}
        <View style={styles.budgetSection}>
          <View style={styles.budgetHeader}>
            <Text style={styles.budgetTitle}>BUDGET DASHBOARD</Text>
          </View>

          <View style={styles.tabContainer}>
            {BUDGET_TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeBudgetTab === tab && styles.tabActive
                ]}
                onPress={() => handleBudgetTabPress(tab)}
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
          <ScrollView
            ref={budgetPagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => handleBudgetSwipeEnd(event.nativeEvent.contentOffset.x)}
            onLayout={(event) => {
              const width = Math.max(0, event.nativeEvent.layout.width);
              if (width !== budgetPagerWidth) {
                setBudgetPagerWidth(width);
              }
            }}
            contentContainerStyle={styles.budgetPagerContent}
          >
            {BUDGET_TABS.map((tab) => (
              <View
                key={tab}
                style={[
                  styles.budgetPage,
                  budgetPagerWidth > 0 && { width: budgetPagerWidth },
                ]}
              >
                {budgetsByTab[tab].map((budget, index) => (
                  <View key={budget.name} style={styles.budgetCard}>
                    <View style={styles.budgetCategoryHeader}>
                      <View style={styles.budgetCategoryLeft}>
                        <Text style={styles.budgetEmoji}>{budget.emoji}</Text>
                        <Text style={styles.budgetCategoryName}>{budget.name}</Text>
                      </View>
                      <Text style={styles.budgetCategoryAmount}>
                        ${budget.spent.toFixed(2)} / ${budget.limit.toFixed(2)}
                      </Text>
                    </View>
                    <AnimatedProgressBar
                      targetPercent={budget.percent}
                      color={budget.color}
                      delay={600 + index * 150}
                      animationKey={
                        tab === activeBudgetTab
                          ? `active-${activeBudgetTab}`
                          : `inactive-${tab}`
                      }
                    />
                    <Text
                      style={[
                        styles.budgetProjection,
                        budget.projection > 100 && styles.budgetProjectionWarning,
                      ]}
                    >
                      Projected End: {budget.projection}%
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Heart burst overlay (above ScrollView) */}
      {heartBurst && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <HeartBurst
            x={heartBurst.x}
            y={heartBurst.y}
            onFinish={() => setHeartBurst(null)}
          />
        </View>
      )}

      {/* Quests Modal */}
      <ScottyQuestsModal
        visible={showQuestsModal}
        onClose={onCloseQuestsModal || (() => {})}
        quests={quests}
        onRefreshQuests={handleRefreshQuests}
      />
    </View>
  );
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
  sectionHeaderTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
    marginBottom: 12,
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
  budgetPagerContent: {
    flexGrow: 1,
  },
  budgetPage: {
    paddingBottom: 8,
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
