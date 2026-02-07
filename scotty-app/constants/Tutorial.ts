export type TutorialScreen = 'home' | 'chat' | 'feed';
export type FeedTabKey = 'transactions' | 'analytics' | 'health';

export type TutorialStep = {
  id: string;
  screen: TutorialScreen;
  title: string;
  body: string;
  primaryLabel: string;
  tab?: FeedTabKey;
  isFinal?: boolean;
  /** When true, dismiss modal and wait for user to feed Scotty before advancing. */
  waitForFeed?: boolean;
  /** When true, dismiss modal and wait for Scotty to reply in chat before advancing. */
  waitForChat?: boolean;
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
    primaryLabel: 'Try it!',
  },
  {
    id: 'home-feed-try',
    screen: 'home',
    title: 'Your turn!',
    body: 'Drag a treat onto Scotty now.',
    primaryLabel: '',
    waitForFeed: true,
  },
  {
    id: 'home-budget',
    screen: 'home',
    title: 'Budgets and quests',
    body: 'Quests reward treats, and the budget dashboard keeps you on track.',
    primaryLabel: 'Next',
  },
  {
    id: 'home-go-chat',
    screen: 'home',
    title: 'Talk to Scotty',
    body: 'Scotty can answer questions about your spending. Let\'s try the chat.',
    primaryLabel: 'Go to Chat',
  },
  {
    id: 'chat-intro',
    screen: 'chat',
    title: 'Scotty Chat',
    body: 'Tap one of the quick-action prompts above the text box to ask Scotty a question.',
    primaryLabel: 'Try it!',
  },
  {
    id: 'chat-try',
    screen: 'chat',
    title: 'Ask Scotty',
    body: 'Tap a prompt chip to send a question.',
    primaryLabel: '',
    waitForChat: true,
  },
  {
    id: 'chat-go-feed',
    screen: 'chat',
    title: 'Nice! Scotty replied.',
    body: 'You can chat with Scotty anytime. Now let\'s check your Feed.',
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
