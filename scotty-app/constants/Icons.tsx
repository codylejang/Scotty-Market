import React from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// Centralized icon name registry — every icon used in the app
// maps through MaterialCommunityIcons for a consistent sketch/retro look.

export type IconName = keyof typeof ICON_MAP;

const ICON_MAP = {
  // ── Category icons ──
  food_dining: 'food-fork-drink',
  groceries: 'cart',
  transport: 'car',
  entertainment: 'gamepad-variant',
  shopping: 'shopping',
  subscriptions: 'cellphone',
  utilities: 'lightbulb-outline',
  education: 'book-open-variant',
  health: 'heart-pulse',
  other: 'dots-horizontal-circle-outline',

  // ── Budget‐builder category chips ──
  cat_groceries: 'leaf',
  cat_dining: 'silverware-fork-knife',
  cat_travel: 'bus',
  cat_shopping: 'shopping',
  cat_fun: 'movie-open',
  cat_self_care: 'spa',
  cat_misc: 'paw',

  // ── Budget dashboard ──
  cat_food_drink: 'food-fork-drink',
  cat_transportation: 'car',
  cat_entertainment: 'gamepad-variant',
  cat_health: 'heart-pulse',
  cat_subscription: 'credit-card',
  cat_utilities: 'lightbulb-outline',
  cat_education: 'book-open-variant',
  cat_housing: 'home',
  cat_default: 'chart-bar',

  // ── Section headers ──
  section_accounts: 'wallet',
  section_spending: 'bullseye-arrow',
  section_trend: 'chart-line',
  section_goal: 'star',
  section_calendar: 'calendar',
  section_health: 'arm-flex',

  // ── Food / game ──
  bone: 'bone',
  meat: 'food-drumstick',
  coin: 'circle-multiple',
  paw: 'paw',
  heart: 'heart',
  food_beverage: 'cup',
  food_steak: 'food-steak',
  food_apple: 'food-apple',

  // ── UI chrome ──
  search: 'magnify',
  close: 'close',
  check: 'check',
  info: 'information-variant',
  arrow_right: 'arrow-right',
  sparkle: 'auto-fix',
  party: 'party-popper',
  target: 'bullseye-arrow',
  credit_card: 'credit-card',
  clipboard: 'clipboard-text',
  check_circle: 'check-circle',
  pencil: 'pencil',
  calendar: 'calendar',
  heart_green: 'heart',
  diamond: 'diamond-stone',
  cog: 'cog',
  tag: 'tag',
  nav_left: 'chevron-left',
  nav_right: 'chevron-right',

  // ── Mood ──
  mood_happy: 'emoticon-happy',
  mood_sad: 'emoticon-sad',
} as const;

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface ScottyIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export default function ScottyIcon({ name, size = 20, color = '#000' }: ScottyIconProps) {
  const glyph = ICON_MAP[name] as MCIName;
  return <MaterialCommunityIcons name={glyph} size={size} color={color} />;
}
