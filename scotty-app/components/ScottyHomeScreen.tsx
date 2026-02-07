import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
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
import { fetchDailyQuests, refreshDailyQuests } from '../services/api';
import { BudgetItem, Quest, TransactionCategory } from '../types';
import TutorialModal from './TutorialModal';
import { TUTORIAL_STEPS } from '../constants/Tutorial';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type BudgetTab = 'Daily' | 'Monthly' | 'Yearly';

const BUDGET_TABS: BudgetTab[] = ['Daily', 'Monthly', 'Yearly'];

const CATEGORY_EMOJI: Record<string, string> = {
  'Food & Drink': '🍔',
  Groceries: '🛒',
  Transportation: '🚗',
  Entertainment: '🎭',
  Shopping: '🛍️',
  Health: '💊',
  Subscription: '💳',
  Utilities: '💡',
  Education: '📚',
  Housing: '🏠',
};

const CATEGORY_COLORS = ['#9b59b6', '#ff8a65', '#81d4fa', '#4caf50', '#ff6b6b'];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);

const getDailyLimit = (budget: BudgetItem) => {
  if (budget.derivedDailyLimit > 0) return budget.derivedDailyLimit;
  if (budget.frequency === 'Day') return budget.limitAmount;
  if (budget.frequency === 'Week') return budget.limitAmount / 7;
  return budget.limitAmount / 30;
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
  const router = useRouter();
  const {
    feedScotty,
    budgets,
    totalBalance,
    dailySpend,
    scottyState,
    dailyInsight,
    quests: contextQuests,
    tutorial,
    advanceTutorial,
    skipTutorial,
  } = useApp();
  const [activeBudgetTab, setActiveBudgetTab] = useState<BudgetTab>('Daily');
  const budgetPagerRef = useRef<ScrollView>(null);
  const [budgetPagerWidth, setBudgetPagerWidth] = useState(0);

  // Food counts derived from scottyState credits
  const creditShare = Math.max(0, scottyState.foodCredits);
  const [foodCounts, setFoodCounts] = useState({ coffee: 0, food: 0, pets: 0 });
  React.useEffect(() => {
    // Distribute food credits across categories
    const coffee = Math.min(Math.floor(creditShare / 3), creditShare);
    const food = Math.min(Math.floor(creditShare / 3), creditShare - coffee);
    const pets = Math.max(0, creditShare - coffee - food);
    setFoodCounts({ coffee, food, pets });
  }, [creditShare]);

  // Quests data: prefer context (backend) quests, fallback to mock
  const [quests, setQuests] = useState<Quest[]>([]);
  React.useEffect(() => {
    if (contextQuests.length > 0) {
      setQuests(contextQuests);
    } else {
      // Fetch directly if context hasn't loaded yet
      const loadQuests = async () => {
        try {
          const apiQuests = await fetchDailyQuests();
          setQuests(apiQuests);
        } catch (error) {
          console.log('Using mock quests data');
        }
      };
      loadQuests();
    }
  }, [contextQuests]);

  const handleRefreshQuests = useCallback(async () => {
    try {
      const newQuests = await refreshDailyQuests();
      setQuests(newQuests);
    } catch (error) {
      console.log('Failed to refresh quests');
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
  const happinessPercent = Math.max(0, Math.min(100, scottyState.happiness));
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

  const totalDailyLimit = budgets.reduce((sum, budget) => sum + getDailyLimit(budget), 0);
  const dailySpendPercent = totalDailyLimit > 0
    ? Math.min(100, Math.round((dailySpend / totalDailyLimit) * 100))
    : 0;

  const budgetsByTab = useMemo(() => {
    const byTab: Record<BudgetTab, Array<{
      id: string;
      emoji: string;
      name: string;
      spent: number;
      limit: number;
      percent: number;
      projection: number;
      color: string;
    }>> = { Daily: [], Monthly: [], Yearly: [] };

    budgets.forEach((budget, index) => {
      const dailyLimit = getDailyLimit(budget);
      const limits: Record<BudgetTab, number> = {
        Daily: dailyLimit,
        Monthly: dailyLimit * 30,
        Yearly: dailyLimit * 365,
      };
      const emoji = CATEGORY_EMOJI[budget.category] || '📊';
      const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

      (Object.keys(limits) as BudgetTab[]).forEach((tab) => {
        const limit = limits[tab];
        const percent = limit > 0 ? Math.min(100, Math.round((budget.spent / limit) * 100)) : 0;
        byTab[tab].push({
          id: `${budget.id}-${tab}`,
          emoji,
          name: budget.category,
          spent: budget.spent,
          limit,
          percent,
          projection: percent,
          color,
        });
      });
    });

    return byTab;
  }, [budgets]);

  const currentStep = tutorial.active ? TUTORIAL_STEPS[tutorial.step] : null;
  const showTutorial = tutorial.active && currentStep?.screen === 'home';

  const handleTutorialPrimary = () => {
    if (!currentStep) return;
    if (currentStep.id === 'home-go-feed') {
      advanceTutorial();
      router.push('/(tabs)/feed');
      return;
    }
    advanceTutorial();
  };

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
            <Text style={styles.speechText}>
              {dailyInsight?.message
                ? `"${dailyInsight.message}"`
                : '"Save some kibble for later!"'}
            </Text>
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

          {quests.slice(0, 3).map((quest, index) => {
            const percent = quest.goal > 0
              ? Math.min(100, Math.round((quest.progress / quest.goal) * 100))
              : 0;
            const colors = ['#ff8a65', '#9b59b6', '#81d4fa'];
            const iconStyles = [undefined, styles.goalIconBlue, styles.goalIconGreen];
            return (
              <View key={quest.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={[styles.goalIcon, iconStyles[index]]}>
                    <Text style={styles.goalIconText}>{quest.emoji}</Text>
                  </View>
                  <Text style={styles.goalTitle}>{quest.title.toUpperCase()}</Text>
                </View>
                <Text style={styles.goalAmount}>
                  {quest.goal > 0
                    ? `$${quest.progress.toFixed(0)} / $${quest.goal.toFixed(0)}`
                    : `${quest.progress} ${quest.progressUnit}`}
                </Text>
                <AnimatedProgressBar
                  targetPercent={percent}
                  color={colors[index % colors.length]}
                  delay={100 + index * 150}
                />
              </View>
            );
          })}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>DAILY SPEND</Text>
            <Text style={styles.summaryValueLarge}>{formatCurrency(dailySpend)}</Text>
            <AnimatedProgressBar
              targetPercent={dailySpendPercent}
              color="#ff6b6b"
              delay={500}
              height={6}
              small
            />
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>BANK TOTAL</Text>
            <Text style={[styles.summaryValueLarge, styles.summaryValuePurple]}>
              {totalBalance > 0 ? formatCurrency(totalBalance) : '$--'}
            </Text>
            <Text style={styles.todayIncome}>
              {totalDailyLimit > 0
                ? `${dailySpendPercent}% of daily budget used`
                : 'No daily budget set'}
            </Text>
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
                {budgetsByTab[tab].length > 0 ? (
                  budgetsByTab[tab].map((budget, index) => (
                    <View key={budget.id} style={styles.budgetCard}>
                      <View style={styles.budgetCategoryHeader}>
                        <View style={styles.budgetCategoryLeft}>
                          <Text style={styles.budgetEmoji}>{budget.emoji}</Text>
                          <Text style={styles.budgetCategoryName}>{budget.name}</Text>
                        </View>
                        <Text style={styles.budgetCategoryAmount}>
                          {formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}
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
                  ))
                ) : (
                  <View style={styles.budgetCard}>
                    <Text style={styles.budgetCategoryName}>No budgets set up yet</Text>
                  </View>
                )}
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

      <TutorialModal
        visible={!!showTutorial}
        title={currentStep?.title || ''}
        body={currentStep?.body || ''}
        stepIndex={tutorial.step}
        totalSteps={TUTORIAL_STEPS.length}
        primaryLabel={currentStep?.primaryLabel || 'Next'}
        onPrimary={handleTutorialPrimary}
        onSkip={skipTutorial}
      />
    </View>
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
