export type TutorialScreen = 'home' | 'feed';
export type FeedTabKey = 'transactions' | 'analytics' | 'health';

export type TutorialStep = {
  id: string;
  screen: TutorialScreen;
  title: string;
  body: string;
  primaryLabel: string;
  tab?: FeedTabKey;
  isFinal?: boolean;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'home-intro',
    screen: 'home',
    title: "Welcome to Scotty's home",
    body: 'This dashboard tracks Scotty’s mood, your quests, and today’s spending at a glance.',
    primaryLabel: 'Next',
  },
  {
    id: 'home-feed',
    screen: 'home',
    title: 'Feed Scotty',
    body: 'Drag a snack onto Scotty to boost happiness. Good habits earn food credits.',
    primaryLabel: 'Next',
  },
  {
    id: 'home-budget',
    screen: 'home',
    title: 'Budgets and quests',
    body: 'Quests reward treats, and the budget dashboard keeps you on track.',
    primaryLabel: 'Next',
  },
  {
    id: 'home-go-feed',
    screen: 'home',
    title: 'Check your feed',
    body: 'Let’s jump to your Feed to review transactions and insights.',
    primaryLabel: 'Go to Feed',
  },
  {
    id: 'feed-transactions',
    screen: 'feed',
    tab: 'transactions',
    title: 'Transactions',
    body: 'Scan recent spending and spot anything unexpected.',
    primaryLabel: 'Next',
  },
  {
    id: 'feed-analytics',
    screen: 'feed',
    tab: 'analytics',
    title: 'Analytics',
    body: 'Charts show where your money goes and how you trend over time.',
    primaryLabel: 'Next',
  },
  {
    id: 'feed-health',
    screen: 'feed',
    tab: 'health',
    title: 'Goals and budgets',
    body: 'Budgets are guardrails that fund your goals. Set a budget so Scotty can plan your savings.',
    primaryLabel: 'Finish',
    isFinal: true,
  },
];
