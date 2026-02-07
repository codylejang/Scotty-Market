import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  LayoutChangeEvent,
  Modal,
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
import DailySpendRing from './DailySpendRing';
import DraggableFoodItem from './DraggableFoodItem';
import HeartBurst from './HeartBurst';
import ScottyQuestsModal from './ScottyQuestsModal';
import { Scotty, ScottyRef } from './Scotty';
import { useApp } from '../context/AppContext';
import { fetchDailyQuests, refreshDailyQuests } from '../services/api';
import { BudgetItem, Quest, TransactionCategory, BudgetProjectionsResponse } from '../types';
import TutorialModal from './TutorialModal';
import { TUTORIAL_STEPS } from '../constants/Tutorial';
import { Colors, Shadows } from '../constants/Theme';

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

const formatCompact = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(1)}t`;
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}b`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(2)}`;
};

const getDailyLimit = (budget: BudgetItem) => {
  if (budget.derivedDailyLimit > 0) return budget.derivedDailyLimit;
  if (budget.frequency === 'Day') return budget.limitAmount;
  if (budget.frequency === 'Week') return budget.limitAmount / 7;
  return budget.limitAmount / 30;
};

function QuestCard({ quest, index }: { quest: Quest; index: number }) {
  const [showInfo, setShowInfo] = useState(false);
  const percent = quest.goal > 0
    ? Math.min(100, Math.round((quest.progress / quest.goal) * 100))
    : 0;
  const isComplete = quest.status === 'completed';
  const isFailed = quest.status === 'failed';
  const isOverBudget = quest.status === 'active' && quest.goal > 0 && quest.progress >= quest.goal;
  const colors = ['#ff8a65', '#9b59b6', '#81d4fa'];
  const iconStyles = [undefined, styles.goalIconBlue, styles.goalIconGreen];

  return (
    <View style={[
      styles.goalCard,
      isComplete && styles.goalCardComplete,
      isFailed && styles.goalCardFailed,
    ]}>
      <View style={styles.goalHeader}>
        <View style={[styles.goalIcon, iconStyles[index]]}>
          <Text style={styles.goalIconText}>
            {isComplete ? '✅' : isFailed ? '❌' : quest.emoji}
          </Text>
        </View>
        <Text
          style={[
            styles.goalTitle,
            isComplete && styles.goalTitleComplete,
            isFailed && styles.goalTitleFailed,
          ]}
          numberOfLines={2}
        >
          {quest.title.toUpperCase()}
        </Text>
        <TouchableOpacity
          style={styles.questInfoButton}
          onPress={() => setShowInfo(!showInfo)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.questInfoButtonText}>{showInfo ? '✕' : 'i'}</Text>
        </TouchableOpacity>
      </View>
      {isComplete ? (
        <Text style={styles.goalCompleteLabel}>QUEST CLEARED  +{quest.xpReward} XP</Text>
      ) : isFailed ? (
        <Text style={styles.goalFailedLabel}>QUEST FAILED</Text>
      ) : (
        <>
          <Text style={[styles.goalAmount, isOverBudget && styles.goalAmountOver]}>
            {quest.goal > 0
              ? `$${quest.progress.toFixed(0)} / $${quest.goal.toFixed(0)}`
              : `${quest.progress} ${quest.progressUnit}`}
            {isOverBudget ? '  OVER!' : ''}
          </Text>
          <AnimatedProgressBar
            targetPercent={percent}
            color={isOverBudget ? '#ff6b6b' : colors[index % colors.length]}
            delay={100 + index * 150}
          />
        </>
      )}
      {showInfo && (
        <View style={styles.questInfoBox}>
          <Text style={styles.questInfoText}>{quest.subtitle}</Text>
          {quest.goalTarget ? (
            <Text style={styles.questInfoGoal}>Goal: {quest.goalTarget}</Text>
          ) : null}
          <Text style={styles.questInfoXp}>+{quest.xpReward} XP</Text>
        </View>
      )}
    </View>
  );
}

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
    budgetProjections,
    transactions,
    totalBalance,
    dailySpend,
    scottyState,
    dailyInsight,
    quests: contextQuests,
    goals,
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

  // Quests data: prefer context (backend) quests, fallback to empty
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

  // Resync daily quests — re-fetches latest state (picks up validation agent results)
  const [isSyncing, setIsSyncing] = useState(false);
  const handleResyncQuests = useCallback(async () => {
    setIsSyncing(true);
    try {
      const latest = await fetchDailyQuests();
      setQuests(latest);
    } catch (error) {
      console.log('Failed to resync quests');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Demo popup — hardcoded yesterday's completed quest that awards food credits
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoClaimed, setDemoClaimed] = useState(false);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const DEMO_QUEST: Quest = {
    id: 'demo_yesterday',
    title: 'Skip Starbucks',
    subtitle: 'No Starbucks charges detected yesterday. Scotty verified your transactions!',
    emoji: '☕',
    xpReward: 50,
    progress: 0,
    goal: 1,
    progressUnit: 'charges',
    bgColor: '#c8e6c9',
    status: 'completed',
  };

  const handleClaimReward = useCallback(() => {
    setDemoClaimed(true);
    // Award food credits to Scotty
    feedScotty('treat');
    setFoodCounts((prev) => ({ ...prev, food: prev.food + 2 }));
    setTimeout(() => {
      setShowDemoModal(false);
      // Reset for re-demo
      setTimeout(() => setDemoClaimed(false), 500);
    }, 1500);
  }, [feedScotty]);

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

  // Tutorial state — must be declared before handleFeed
  const currentStep = tutorial.active ? TUTORIAL_STEPS[tutorial.step] : null;
  const isWaitingForFeed = currentStep?.waitForFeed === true;
  const showTutorial = tutorial.active && currentStep?.screen === 'home' && !isWaitingForFeed;

  // Grant a bonus food credit during the interactive feed tutorial step
  const [tutorialFoodGranted, setTutorialFoodGranted] = React.useState(false);
  React.useEffect(() => {
    if (isWaitingForFeed && !tutorialFoodGranted) {
      const total = foodCounts.coffee + foodCounts.food + foodCounts.pets;
      if (total <= 0) {
        setFoodCounts((prev) => ({ ...prev, food: prev.food + 1 }));
      }
      setTutorialFoodGranted(true);
    }
  }, [isWaitingForFeed, tutorialFoodGranted, foodCounts]);

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

      // Call context feedScotty — meat is a meal, others are treats
      feedScotty(type === 'coffee' ? 'meal' : 'treat');

      // If we're on the interactive tutorial feed step, wait 2s so user sees Scotty become happy
      if (isWaitingForFeed) {
        setTimeout(() => advanceTutorial(), 2000);
      }
    },
    [foodCounts, scottyLayout, feedScotty, isWaitingForFeed, advanceTutorial]
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

  // Compute today's actual spending per budget category from real transactions
  const todaySpendByCategory = useMemo(() => {
    const catMap: Record<string, string[]> = {
      'Food & Drink': ['food_dining', 'groceries'],
      'Groceries': ['groceries'],
      'Transportation': ['transport'],
      'Entertainment': ['entertainment'],
      'Shopping': ['shopping'],
      'Health': ['health'],
      'Subscription': ['subscriptions'],
    };
    const now = new Date();

    const result: Record<string, number> = {};
    for (const [budgetCat, frontendCats] of Object.entries(catMap)) {
      const todayTxns = transactions.filter(t => {
        // Match "today" the same way TransactionList does: time diff < 24 hours
        const d = t.date instanceof Date ? t.date : new Date(t.date);
        const diffMs = now.getTime() - d.getTime();
        const isToday = diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000;
        return isToday
          && frontendCats.includes(t.category)
          && !t.isIncoming;
      });
      result[budgetCat] = todayTxns.reduce((sum, t) => sum + t.amount, 0);
    }
    return result;
  }, [transactions]);

  const budgetsByTab = useMemo(() => {
    const byTab: Record<BudgetTab, Array<{
      id: string;
      emoji: string;
      name: string;
      spent: number;
      limit: number;
      percent: number;
      projection: number;
      overBudget: boolean;
      color: string;
    }>> = { Daily: [], Monthly: [], Yearly: [] };

    // Build a lookup from projections by category
    const projectionMap = new Map<string, { projectedPercent: number; overBudget: boolean; dailyRate7d: number }>();
    if (budgetProjections?.projections) {
      for (const p of budgetProjections.projections) {
        projectionMap.set(p.category, { projectedPercent: p.projectedPercent, overBudget: p.overBudget, dailyRate7d: p.dailyRate7d });
      }
    }

    budgets.forEach((budget, index) => {
      const dailyLimit = getDailyLimit(budget);

      const limits: Record<BudgetTab, number> = {
        Daily: dailyLimit,
        Monthly: dailyLimit * 30,
        Yearly: dailyLimit * 365,
      };
      // Daily: today's actual spending; Monthly: period total; Yearly: extrapolated from monthly
      const todayCatSpend = todaySpendByCategory[budget.category] || 0;
      const spentByTab: Record<BudgetTab, number> = {
        Daily: todayCatSpend,
        Monthly: budget.spent,
        Yearly: budget.spent * 12,
      };
      const emoji = CATEGORY_EMOJI[budget.category] || '📊';
      const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

      // Look up AI projection for this category
      const proj = projectionMap.get(budget.category);

      (Object.keys(limits) as BudgetTab[]).forEach((tab) => {
        const limit = limits[tab];
        const spent = spentByTab[tab];
        const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;

        // Tab-aware projections:
        // Daily: project based on recent 7-day daily rate vs daily limit
        // Monthly: use backend's period projection (default)
        // Yearly: extrapolate from monthly projection
        let projection: number;
        let overBudget: boolean;
        if (proj) {
          if (tab === 'Daily') {
            projection = dailyLimit > 0
              ? Math.round((proj.dailyRate7d / dailyLimit) * 100)
              : 0;
          } else {
            // Monthly and Yearly use the same period-based projection ratio
            projection = proj.projectedPercent;
          }
          overBudget = projection > 100;
        } else {
          projection = percent;
          overBudget = percent > 100;
        }

        byTab[tab].push({
          id: `${budget.id}-${tab}`,
          emoji,
          name: budget.category,
          spent,
          limit,
          percent,
          projection,
          overBudget,
          color,
        });
      });
    });

    return byTab;
  }, [budgets, budgetProjections, todaySpendByCategory]);

  const handleTutorialPrimary = () => {
    if (!currentStep) return;
    if (currentStep.id === 'home-go-chat') {
      advanceTutorial();
      router.push('/(tabs)/chat');
      return;
    }
    advanceTutorial();
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Floating hint banner during interactive feed step */}
      {isWaitingForFeed && (
        <View style={styles.feedHintBanner}>
          <Text style={styles.feedHintText}>🐾  Drag a treat onto Scotty!</Text>
        </View>
      )}
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
                : '"Woof! Loading your insights..."'}
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
                <Scotty ref={scottyAnimRef} size={160} mood={scottyState.mood} />
              </View>
            </View>

            <View style={styles.categoryIcons}>
              <DraggableFoodItem
                emoji="🧋"
                count={foodCounts.food}
                bgColor="#FFD8B1"
                scottyLayout={scottyLayout}
                onFeed={() => handleFeed('food')}
              />
              <DraggableFoodItem
                emoji="🥩"
                count={foodCounts.coffee}
                bgColor="#e1bee7"
                scottyLayout={scottyLayout}
                onFeed={() => handleFeed('coffee')}
              />
              <DraggableFoodItem
                emoji="🍎"
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
              <Text style={styles.meterValue}>{Math.round(scottyState.happiness)}%</Text>
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
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>DAILY QUESTS</Text>
            <View style={styles.sectionHeaderButtons}>
              <TouchableOpacity
                style={styles.resyncButton}
                onPress={handleResyncQuests}
                disabled={isSyncing}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.resyncText, isSyncing && styles.resyncTextDisabled]}>
                  {isSyncing ? '...' : '↻ SYNC'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.demoButton}
                onPress={() => setShowDemoModal(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.demoButtonText}>DEMO</Text>
              </TouchableOpacity>
            </View>
          </View>

          {quests.slice(0, 3).map((quest, index) => (
            <QuestCard key={quest.id} quest={quest} index={index} />
          ))}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>DAILY SPEND</Text>
            <View style={styles.dailySpendRingRow}>
              <DailySpendRing spent={dailySpend} limit={totalDailyLimit} size={72} />
              <View style={styles.dailySpendText}>
                <Text style={styles.summaryValueMedium}>{formatCurrency(dailySpend)}</Text>
                <Text style={styles.dailySpendLimit}>of {formatCurrency(totalDailyLimit)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>BANK TOTAL</Text>
            <Text style={[styles.summaryValueLarge, styles.summaryValuePurple]}>
              {totalBalance > 0 ? formatCompact(totalBalance) : '$--'}
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
                          budget.overBudget && styles.budgetProjectionWarning,
                        ]}
                      >
                        {budget.overBudget
                          ? `OVER BUDGET! Projected: ${budget.projection}%`
                          : `Projected End: ${budget.projection}%`}
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

      {/* Demo Quest Reward Modal */}
      <Modal
        visible={showDemoModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDemoModal(false)}
      >
        <View style={styles.demoOverlay}>
          <View style={styles.demoModalContainer}>
            {/* Header */}
            <View style={styles.demoModalHeader}>
              <Text style={styles.demoModalTitle}>YESTERDAY'S QUEST</Text>
              <Text style={styles.demoModalDate}>{yesterdayStr}</Text>
              <TouchableOpacity
                onPress={() => setShowDemoModal(false)}
                style={styles.demoCloseBtn}
              >
                <View style={styles.demoCloseBtnInner}>
                  <Text style={styles.demoCloseText}>✕</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Quest Card */}
            <View style={styles.demoQuestCard}>
              <View style={styles.demoQuestRow}>
                <View style={[styles.goalIcon, { backgroundColor: DEMO_QUEST.bgColor }]}>
                  <Text style={styles.goalIconText}>{DEMO_QUEST.emoji}</Text>
                </View>
                <View style={styles.demoQuestDetails}>
                  <Text style={styles.demoQuestTitle}>{DEMO_QUEST.title.toUpperCase()}</Text>
                  <Text style={styles.demoQuestXp}>+{DEMO_QUEST.xpReward} XP</Text>
                </View>
              </View>
              <Text style={styles.demoQuestSubtitle}>{DEMO_QUEST.subtitle}</Text>
              <View style={styles.demoVerifiedBadge}>
                <Text style={styles.demoVerifiedText}>✅ VERIFIED BY SCOTTY</Text>
              </View>
            </View>

            {/* Reward */}
            <View style={styles.demoRewardSection}>
              <Text style={styles.demoRewardLabel}>REWARD EARNED</Text>
              <View style={styles.demoRewardRow}>
                <Text style={styles.demoRewardEmoji}>🧋</Text>
                <Text style={styles.demoRewardName}>2x Boba Treats</Text>
              </View>
              <Text style={styles.demoRewardHint}>Feed these to Scotty to boost happiness!</Text>
            </View>

            {/* Claim Button */}
            <TouchableOpacity
              style={styles.demoClaimButton}
              onPress={handleClaimReward}
              disabled={demoClaimed}
            >
              <LinearGradient
                colors={demoClaimed ? ['#4caf50', '#66bb6a'] : ['#ff6b6b', '#9b59b6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.demoClaimGradient}
              >
                <Text style={styles.demoClaimText}>
                  {demoClaimed ? 'CLAIMED!' : 'CLAIM REWARD'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quests Modal */}
      <ScottyQuestsModal
        visible={showQuestsModal}
        onClose={onCloseQuestsModal || (() => {})}
        quests={quests}
        goals={goals}
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
  feedHintBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: Colors.coral,
    borderBottomWidth: 2,
    borderBottomColor: Colors.ink,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  feedHintText: {
    fontFamily: 'SpaceMono',
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 0.5,
  },
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
  },
  resyncButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  resyncText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  resyncTextDisabled: {
    color: '#999',
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
  goalCardComplete: {
    opacity: 0.55,
    borderColor: '#4caf50',
  },
  goalTitleComplete: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  goalCompleteLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: '#4caf50',
    letterSpacing: 2,
  },
  goalCardFailed: {
    opacity: 0.4,
    borderColor: '#ff6b6b',
  },
  goalTitleFailed: {
    textDecorationLine: 'line-through',
    color: '#ccc',
  },
  goalFailedLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: '#ff6b6b',
    letterSpacing: 2,
  },
  goalAmountOver: {
    color: '#ff6b6b',
    fontWeight: '900',
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
    flex: 1,
  },
  questInfoButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff9c4',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  questInfoButtonText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
  },
  questInfoBox: {
    marginTop: 10,
    backgroundColor: '#fff9c4',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    padding: 12,
  },
  questInfoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    lineHeight: 18,
  },
  questInfoGoal: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: '#9b59b6',
    marginTop: 6,
  },
  questInfoXp: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#4caf50',
    marginTop: 4,
    letterSpacing: 1,
  },
  goalAmount: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#ff6b6b',
    marginBottom: 6,
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
    justifyContent: 'center',
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
  summaryValueMedium: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  dailySpendRingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  dailySpendText: {
    flex: 1,
  },
  dailySpendLimit: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    marginTop: 2,
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

  // Section header buttons row
  sectionHeaderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  demoButton: {
    backgroundColor: '#9b59b6',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  demoButtonText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },

  // Demo Modal
  demoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  demoModalContainer: {
    backgroundColor: '#fff6f3',
    borderWidth: 4,
    borderColor: '#000',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    overflow: 'hidden',
  },
  demoModalHeader: {
    padding: 20,
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  demoModalTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  demoModalDate: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 2,
    marginTop: 2,
  },
  demoCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  demoCloseBtnInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  demoCloseText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  demoQuestCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#4caf50',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  demoQuestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  demoQuestDetails: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  demoQuestTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  demoQuestXp: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#9b59b6',
  },
  demoQuestSubtitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    lineHeight: 16,
    marginBottom: 12,
  },
  demoVerifiedBadge: {
    backgroundColor: '#e8f5e9',
    borderWidth: 2,
    borderColor: '#4caf50',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  demoVerifiedText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#4caf50',
    letterSpacing: 1,
  },
  demoRewardSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  demoRewardLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#999',
    letterSpacing: 2,
    marginBottom: 8,
  },
  demoRewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  demoRewardEmoji: {
    fontSize: 28,
  },
  demoRewardName: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
  },
  demoRewardHint: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    fontWeight: '600',
    color: '#999',
    textAlign: 'center',
  },
  demoClaimButton: {
    margin: 16,
    marginTop: 0,
  },
  demoClaimGradient: {
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#000',
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  demoClaimText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
});
